# Arquitetura

Como o sistema está organizado. Para o escopo funcional, ver [SPEC](SPEC.md);
para as justificativas das escolhas, [DECISIONS](DECISIONS.md).

---

## 1. Dois contextos de dados

O princípio que estrutura o resto da aplicação: existem dois tipos de banco, com
finalidades e tecnologias distintas.

**Banco interno da plataforma** — metadados da ferramenta (usuários, projetos,
conexões, consultas, endpoints, chaves, logs). Schema conhecido em tempo de
desenvolvimento e versionado por migrations.

```text
NestJS → Prisma → PostgreSQL da plataforma
```

**Bancos dos usuários** — PostgreSQL de terceiros, com schema arbitrário
descoberto em tempo de execução e fora da governança da aplicação.

```text
NestJS → node-postgres (pg) → PostgreSQL do usuário
```

Daí decorre que o Prisma é usado exclusivamente no banco interno, que não existe
schema Prisma nem migration para banco de usuário, e que a aplicação nunca
executa migration em banco externo.

---

## 2. Control Plane e Data Plane

A aplicação é um **monólito modular**: um processo NestJS, com separação lógica
por módulos, sem fronteiras de rede.

```text
Control Plane                        Data Plane / Runtime

Next.js (apps/web)                   Cliente HTTP
   ↓ JWT                                ↓ x-api-key
NestJS — Auth, Projects,             NestJS — RuntimeModule
Connections, Introspection,             ↓
SavedQueries, Endpoints,             SavedQuery + QueryParameter
ApiKeys, Logs, OpenAPI                  ↓ node-postgres
   ↓ Prisma                          PostgreSQL do usuário
PostgreSQL da plataforma
```

As duas autenticações são independentes e não se misturam. O guard JWT é global;
o runtime é a única rota marcada como pública, e valida a API Key internamente.

---

## 3. Modelo de execução

Publicar um endpoint não gera arquivo de controller. Uma rota genérica resolve
todos os endpoints em tempo de requisição:

```http
GET /runtime/:projectSlug/:version/:endpointSlug
```

```text
resolver endpoint publicado (projeto + versão + slug)
   ↓
autenticar API Key e conferir o projeto
   ↓
carregar SavedQuery, parâmetros e conexão
   ↓
converter e validar os valores recebidos
   ↓
executar SQL parametrizado via pg, com limite aplicado
   ↓
retornar JSON e registrar RequestLog
```

O endpoint é resolvido **antes** da autenticação para que uma falha de chave
possa ser registrada com o endpoint que se tentou acessar; `RequestLog` exige um
`endpointId`. Rota inexistente é o único caminho sem registro.

`Endpoint` referencia `SavedQuery` e não duplica o SQL. A mesma função de
execução atende o runtime e a execução de teste do painel, para que as garantias
de segurança não divirjam entre os dois caminhos.

---

## 4. Modelo de dados interno

```text
User
 └── Project
      ├── DatabaseConnection
      │      └── SavedQuery
      │             ├── QueryParameter
      │             └── Endpoint
      ├── Endpoint
      │      └── RequestLog
      └── ApiKey
             └── RequestLog
```

Políticas de exclusão:

- `Cascade` no que é parte indissociável do pai — projetos de um usuário,
  conexões e endpoints de um projeto, parâmetros de uma consulta;
- `Restrict` no que sustenta artefatos publicados — uma conexão com consultas e
  uma consulta com endpoints não podem ser removidas;
- `SetNull` em `RequestLog.apiKeyId`, preservando o histórico após a revogação.

A posse é sempre verificada pela cadeia até o `User`, e recursos de outro
proprietário respondem 404 em vez de 403: informar "proibido" confirmaria a
existência do recurso.

---

## 5. Acesso ao banco interno

`PrismaService` estende `PrismaClient` sobre o driver adapter
`@prisma/adapter-pg` e um `Pool` do `pg`. Conecta em `OnModuleInit` e encerra
client e pool em `OnModuleDestroy`; `main.ts` habilita `enableShutdownHooks()`.

O client é gerado em `apps/api/src/generated/prisma`, com `moduleFormat = "cjs"`,
e não é versionado. O `datasource` declara apenas o provider — a URL é resolvida
em `prisma.config.ts` a partir de `DATABASE_URL`.

---

## 6. Acesso aos bancos externos

`ExternalDatabaseService` é o ponto único: decifra a credencial, abre um cliente
temporário, aplica timeouts de 5 s (conexão, `query_timeout` e
`statement_timeout`), encerra o cliente em `finally` e converte erros do
PostgreSQL em respostas seguras. Nenhum módulo de negócio repete essas
responsabilidades.

A introspecção consulta `pg_catalog` — e não `information_schema` — porque
precisa da ordem das colunas em chaves compostas e do tipo formatado da coluna,
que o padrão não expõe de forma confiável. Schema e tabela viajam sempre como
parâmetros posicionais.

---

## 7. Segurança arquitetural

- credenciais externas cifradas com AES-256-GCM (`CryptoService`); o valor
  armazenado concatena IV, authentication tag e ciphertext, e a chave vem de
  `CONNECTION_ENCRYPTION_KEY`, nunca gravada no banco;
- API Keys guardadas apenas como hash SHA-256, com prefixo curto para
  identificação visual;
- validação de SQL que normaliza comentários, literais e identificadores antes de
  analisar, de modo que um comando escondido após um comentário não escape;
- parâmetros sempre enviados como valores posicionais ao driver;
- limite de linhas aplicado envolvendo a consulta original, com valor controlado
  pela aplicação;
- erros do PostgreSQL não são repassados crus ao cliente;
- CORS por lista explícita de origens, sem curinga.

---

## 8. Configuração TypeScript

O backend usa `module: Node16` / `moduleResolution: Node16` com `strict: true`,
sem `"type": "module"` e sem extensão `.js` nos imports. Configuração estável
para o conjunto NestJS 11 + Prisma 7 adotado.

---

## 9. Containers

Quatro serviços em `docker-compose.yml`:

| Serviço | Container | Porta host → interna | Papel |
|---|---|---|---|
| `web` | `gerador-api-web` | 3000 | painel Next.js |
| `api` | `gerador-api-backend` | 3001 | API NestJS |
| `postgres-platform` | `gerador-api-platform-db` | 5434 → 5432 | banco interno |
| `postgres-demo` | `gerador-api-demo-db` | 5435 → 5432 | banco externo de demonstração |

A porta 5432 do host está ocupada por uma instalação nativa de PostgreSQL, o que
explica 5434 e 5435. Dentro da rede do compose os serviços se alcançam pelo nome
e pela porta interna: a API acessa `postgres-platform:5432`, e uma
`DatabaseConnection` para o banco demo aponta para `postgres-demo:5432`. Fora do
Docker, os mesmos bancos respondem em `127.0.0.1:5434` e `127.0.0.1:5435`.

`NEXT_PUBLIC_API_URL` é embutido no bundle em tempo de build e precisa ser o
endereço alcançável pelo **navegador**, não o nome do serviço.

Instruções de execução ficam no [README](../README.md).

---

## 10. Estrutura do monorepo

```text
Meu-gerador-de-api/
├── apps/
│   ├── api/        NestJS + Prisma + pg
│   └── web/        Next.js
├── packages/
│   └── contracts/  reservado para contratos compartilhados
├── docs/
├── infra/
│   ├── benchmark/      script de avaliação do runtime
│   └── demo-database/  scripts SQL do banco de demonstração
└── docker-compose.yml
```

Gerenciador de pacotes: pnpm, com workspace único na raiz.

Módulos do backend em `apps/api/src`: `auth`, `projects`,
`database-connections`, `database-introspection`, `saved-queries`, `endpoints`,
`runtime`, `api-keys`, `request-logs`, `openapi`, `health`, além de `common`
(crypto, ownership, slug, CORS) e `database` (Prisma). `PrismaModule` e
`CryptoModule` são `@Global`, por serem infraestrutura transversal.
