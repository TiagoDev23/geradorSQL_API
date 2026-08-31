# API Generator

Plataforma web para criação dinâmica de endpoints REST a partir de consultas SQL
em bancos PostgreSQL.

## Visão geral

O usuário conecta um PostgreSQL que já existe, inspeciona sua estrutura, escreve
um `SELECT` parametrizado e publica essa consulta como uma rota HTTP protegida
por API Key.

```text
PostgreSQL existente
      ↓ introspecção
estrutura visível no painel
      ↓
consulta SELECT parametrizada
      ↓ publicação
endpoint REST (x-api-key)
      ↓
logs, métricas e OpenAPI
```

Publicar um endpoint não gera código: a rota é resolvida em tempo de requisição
a partir do que está cadastrado.

## Funcionalidades

- autenticação de usuários e projetos por proprietário
- conexões PostgreSQL com teste de conectividade
- introspecção de schemas, tabelas, views, colunas, PK e FK
- consultas `SELECT` salvas, com parâmetros tipados e execução de teste
- endpoints REST dinâmicos, versionados e publicáveis
- API Keys com revogação e expiração
- logs de requisição e métricas por projeto
- especificação OpenAPI gerada dos endpoints publicados
- interface web

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, CodeMirror 6 |
| Backend | NestJS, TypeScript |
| Banco interno | PostgreSQL via Prisma |
| Bancos dos usuários | PostgreSQL via node-postgres (`pg`) |
| Infraestrutura | Docker Compose, monorepo pnpm |

## Arquitetura resumida

```text
Control Plane                     Data Plane / Runtime

Browser                           Cliente HTTP
   ↓                                 ↓ x-api-key
Next.js                           NestJS (runtime)
   ↓ JWT                             ↓
NestJS                            SavedQuery + parâmetros
   ↓ Prisma                          ↓ node-postgres
PostgreSQL interno                PostgreSQL do usuário
```

As duas autenticações são independentes: o painel usa JWT, os endpoints
publicados usam `x-api-key`. Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Pré-requisitos

Para executar a stack completa: Git, Docker e Docker Compose.

Para desenvolvimento fora do Docker: Node.js 22+ e pnpm 11, além dos containers
de banco.

## Configuração

```bash
git clone <url-do-repositorio>
cd Meu-gerador-de-api

cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Preencha os dois arquivos:

- `.env` — credenciais dos containers PostgreSQL e `NEXT_PUBLIC_API_URL`;
- `apps/api/.env` — `DATABASE_URL`, `CONNECTION_ENCRYPTION_KEY` e `JWT_SECRET`.

Os dois segredos da aplicação devem ser gerados localmente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"    # CONNECTION_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" # JWT_SECRET
```

Nenhum segredo é versionado. Os arquivos `.env.example` contêm apenas os nomes
das variáveis.

## Executar com Docker

```bash
docker compose up --build -d
```

| Serviço | Endereço |
|---|---|
| Painel web | http://localhost:3000 |
| API | http://localhost:3001 |
| PostgreSQL da plataforma | localhost:5434 |
| PostgreSQL de demonstração | localhost:5435 |

A API aplica as migrations pendentes com `prisma migrate deploy` na
inicialização. Para acompanhar e encerrar:

```bash
docker compose ps
docker compose logs api --tail 30
docker compose down
```

> `docker compose down -v` apagaria os volumes dos bancos. Não faz parte do uso
> normal.

## Desenvolvimento local

Com os containers de banco no ar:

```bash
pnpm install
pnpm dev:api    # http://localhost:3001
pnpm dev:web    # http://localhost:3000
```

Neste modo a API acessa os bancos pelo host: a plataforma em `127.0.0.1:5434` e
o banco demo em `127.0.0.1:5435`.

## Fluxo principal

```text
criar conta → criar projeto → cadastrar conexão PostgreSQL → testar conexão →
explorar schemas e tabelas → escrever SELECT com parâmetros → executar →
publicar como endpoint → criar API Key → consumir → acompanhar logs e OpenAPI
```

## Consumo de um endpoint

```http
GET /runtime/:projectSlug/:version/:endpointSlug
x-api-key: <sua-api-key>
```

```bash
curl "http://localhost:3001/runtime/clima-demo/v1/observacoes?estacaoId=1" \
  -H "x-api-key: SUA_API_KEY"
```

A resposta traz `columns`, `rows`, `rowCount`, `maxRows`, `truncated` e
`durationMs`. O limite de registros é definido por endpoint e aplicado pela
plataforma.

## Banco de demonstração

O repositório inclui um banco PostgreSQL sintético de meteorologia e impactos
climáticos, usado para demonstrar a plataforma sobre um schema realista com
múltiplos schemas, chaves compostas e views. Ele é tratado como um banco externo
qualquer. Ver [docs/METEOROLOGY_DATABASE.md](docs/METEOROLOGY_DATABASE.md).

## Segurança

- credenciais de bancos externos cifradas com AES-256-GCM; a chave da aplicação
  nunca é persistida
- API Keys armazenadas apenas como hash, exibidas em texto puro uma única vez
- consultas restritas a leitura, validadas antes de gravar e de executar
- valores recebidos nunca são concatenados ao SQL: execução sempre parametrizada
- recursos acessíveis apenas ao usuário proprietário
- CORS por lista explícita de origens, sem curinga

Nenhuma auditoria externa foi realizada. Ver
[docs/DECISIONS.md](docs/DECISIONS.md) para as justificativas.

## Testes e qualidade

```bash
pnpm --filter api test
pnpm --filter web test
pnpm lint
pnpm build
```

Estado atual: 361 testes no backend e 25 no painel. O fechamento do MVP incluiu
uma avaliação de desempenho do runtime em ambiente local, registrada em
[docs/DEVELOPMENT_REPORT.md](docs/DEVELOPMENT_REPORT.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [SPEC](docs/SPEC.md) | o que o sistema faz e a fronteira do MVP |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | como o sistema está estruturado |
| [DECISIONS](docs/DECISIONS.md) | decisões técnicas e suas justificativas |
| [DEVELOPMENT_REPORT](docs/DEVELOPMENT_REPORT.md) | evolução da implementação e resultados |
| [METEOROLOGY_DATABASE](docs/METEOROLOGY_DATABASE.md) | banco de demonstração |

## Limitações

- PostgreSQL é o único SGBD suportado
- runtime restrito a `GET` sobre consultas `SELECT`
- sem paginação automática sobre SQL arbitrário; o controle é o limite de linhas
  por endpoint
- sem rate limiting
- sem Swagger UI embarcado — a especificação é servida em JSON
- a avaliação de desempenho descreve um ambiente local, não capacidade de
  produção

## Contexto

Desenvolvido como Trabalho de Conclusão de Curso. O objetivo é demonstrar a
criação dinâmica de endpoints REST para consulta de grandes volumes de dados em
PostgreSQL, não entregar um produto operado em produção.
