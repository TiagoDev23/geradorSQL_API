# ARCHITECTURE — Arquitetura da solução

Documento derivado de `CLAUDE.md` e do código existente no repositório.
Descreve como a aplicação está organizada e por que existem dois caminhos
distintos de acesso a dados.

---

## 1. Princípio central: dois contextos de dados

A aplicação manipula dois tipos de banco com finalidades e tecnologias distintas.

**Banco interno da plataforma** — dados administrativos da ferramenta (usuários,
projetos, conexões, consultas, parâmetros, endpoints, API Keys, logs). Schema
conhecido em tempo de desenvolvimento, versionado por migrations.

```text
NestJS → Prisma → PostgreSQL da plataforma
```

**Bancos PostgreSQL externos** — bancos de terceiros cadastrados pelos usuários.
Schema desconhecido em tempo de desenvolvimento, fora da governança da aplicação.

```text
NestJS → node-postgres (pg) → PostgreSQL do usuário
```

Restrições que decorrem disso:

- Prisma é usado exclusivamente no banco interno;
- não se gera Prisma Client dinamicamente para bancos externos;
- não existe schema Prisma nem migration para banco de usuário;
- a aplicação nunca executa migration em banco externo.

---

## 2. Visão macro

```text
Next.js (apps/web)
      │ HTTP
      ▼
NestJS (apps/api)
      │
      ├── Control Plane
      │     ├── Users/Auth
      │     ├── Projects
      │     ├── Database Connections
      │     ├── Introspection
      │     ├── Saved Queries
      │     ├── Query Parameters
      │     ├── Endpoints
      │     ├── API Keys
      │     └── Logs
      │
      └── Data Plane / Runtime
                │
                ▼
               pg
                │
                ▼
      PostgreSQL cadastrado pelo usuário
```

A aplicação é um **monólito modular**. O Control Plane administra metadados; o
Data Plane executa consultas nos bancos dos usuários. A separação é lógica,
por módulos NestJS — não há divisão em processos ou serviços.

---

## 3. Estrutura do repositório

```text
Meu-gerador-de-api/
├── apps/
│   ├── api/        NestJS + Prisma + pg
│   └── web/        Next.js
├── packages/
│   └── contracts/  reservado para contratos compartilhados
├── docs/
├── infra/
├── docker-compose.yml
└── pnpm-workspace.yaml
```

Gerenciador de pacotes: **pnpm**, com workspace único na raiz.
`packages/contracts` e `infra/` estão reservados e ainda vazios.

---

## 4. Módulos NestJS

Implementados:

| Módulo | Local | Responsabilidade |
|---|---|---|
| `ConfigModule` | global | variáveis de ambiente |
| `PrismaModule` | `src/database/prisma` | acesso ao banco interno |
| `HealthModule` | `src/health` | verificação de disponibilidade |
| `ProjectsModule` | `src/projects` | CRUD de projetos |
| `CryptoModule` | `src/common/crypto` | criptografia de credenciais |

Previstos: `DatabaseConnectionsModule`, `DatabaseIntrospectionModule`,
`SavedQueriesModule`, `EndpointsModule`, `ApiKeysModule`, `RuntimeModule`,
`RequestLogsModule`, `AuthModule`.

`PrismaModule` e `CryptoModule` são declarados `@Global`, pois são
infraestrutura transversal consumida por praticamente todos os módulos de negócio.

---

## 5. Acesso ao banco interno

`PrismaService` estende `PrismaClient` e é configurado com o driver adapter
`@prisma/adapter-pg` sobre um `Pool` do `pg`. O serviço implementa
`OnModuleInit`/`OnModuleDestroy`: conecta na inicialização e, ao encerrar,
desconecta o client e finaliza o pool. `main.ts` habilita `enableShutdownHooks()`
para que esses ciclos sejam efetivamente disparados.

O Prisma Client é gerado em `apps/api/src/generated/prisma`, com
`moduleFormat = "cjs"`, e não é versionado no Git.

A URL de conexão não fica no `schema.prisma`: o datasource declara apenas o
provider, e a URL é resolvida em `prisma.config.ts` a partir de `DATABASE_URL`.

---

## 6. Modelo de dados interno

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

Políticas de exclusão adotadas no schema:

- `Cascade` no que é parte indissociável do pai (projetos de um usuário,
  conexões e endpoints de um projeto, parâmetros de uma consulta);
- `Restrict` no que é referenciado por artefatos publicados — uma
  `DatabaseConnection` com consultas e uma `SavedQuery` com endpoints não podem
  ser removidas, evitando endpoint publicado apontando para origem inexistente;
- `SetNull` em `RequestLog.apiKeyId`, preservando o histórico de requisições
  mesmo após a remoção da chave.

`Endpoint` referencia `SavedQuery` e não duplica o SQL. `Endpoint` não possui
campo `method`, porque no MVP toda publicação é `GET`.

---

## 7. Runtime dinâmico

Nenhum arquivo de controller é gerado quando um endpoint é publicado. Uma única
rota genérica resolve todos os endpoints em tempo de requisição:

```http
GET /runtime/:projectSlug/:version/:endpointSlug
```

Fluxo previsto:

```text
requisição → resolver projeto → resolver endpoint publicado →
carregar SavedQuery → carregar parâmetros ordenados por position →
carregar DatabaseConnection → descriptografar credencial →
validar e converter parâmetros → executar SQL parametrizado via pg →
aplicar limite → retornar JSON → registrar RequestLog
```

Ainda não implementado.

---

## 8. Segurança

- credenciais de bancos externos são cifradas com AES-256-GCM antes de persistir
  em `DatabaseConnection.passwordEncrypted`; a chave da aplicação vem de
  `CONNECTION_ENCRYPTION_KEY` e nunca é gravada no banco;
- o formato armazenado concatena IV, authentication tag e ciphertext, todos em
  hexadecimal, separados por `:` — tudo o que é necessário para decifrar, exceto
  a chave;
- API Keys são armazenadas apenas como hash, acompanhadas de um prefixo curto
  usado para identificação visual;
- consultas passam por camada própria de validação antes da execução;
- parâmetros são sempre enviados como valores posicionais ao PostgreSQL;
- erros do PostgreSQL não são repassados crus ao cliente.

---

## 9. Configuração TypeScript

O backend usa `module: Node16` e `moduleResolution: Node16` com `strict: true`.
`apps/api/package.json` não declara `"type": "module"` e os imports TypeScript
não usam extensão `.js`. Essa configuração é estável para o conjunto
NestJS + Prisma 7 adotado e não deve ser convertida para ESM sem necessidade real.

---

## 10. Ambientes de banco em desenvolvimento

Dois containers definidos em `docker-compose.yml`, ambos `postgres:17-alpine`
com healthcheck e volume nomeado:

| Container | Porta host | Porta interna | Papel |
|---|---|---|---|
| `gerador-api-platform-db` | 5434 | 5432 | banco interno da plataforma |
| `gerador-api-demo-db` | 5435 | 5432 | banco externo de demonstração |

A porta 5432 do host está ocupada por uma instalação de PostgreSQL nativa no
Windows, motivo pelo qual os containers são expostos em 5434 e 5435.

O banco demo representa exclusivamente um banco de usuário: é acessado pela
aplicação através de `pg`, jamais por Prisma.
