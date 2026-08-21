# SPEC — Especificação funcional

Documento derivado de `CLAUDE.md` e do código existente no repositório.
Descreve o que a ferramenta deve fazer e qual é a fronteira do MVP.

---

## 1. Objetivo

Ferramenta web para criação dinâmica de endpoints REST destinados à consulta e
disponibilização de grandes volumes de dados armazenados em bancos PostgreSQL.

O usuário conecta um banco PostgreSQL já existente, escreve consultas `SELECT`,
define parâmetros e publica essas consultas como endpoints HTTP que retornam JSON.

O foco é consulta e disponibilização de dados. O projeto não pretende ser um
backend builder genérico nem reproduzir Supabase, Hasura ou PostgREST.

---

## 2. Escopo do MVP

Incluído:

- PostgreSQL como único SGBD suportado;
- consultas restritas a `SELECT`;
- endpoints publicados exclusivamente como `GET`;
- parâmetros de consulta tipados;
- resposta em JSON;
- autenticação de consumo por API Key;
- registro de logs de requisição;
- limitação da quantidade de registros retornados;
- interface web;
- documentação dos endpoints publicados;
- execução dinâmica das consultas, sem geração de código por endpoint.

Fora do MVP:

- `INSERT`, `UPDATE`, `DELETE`, `PATCH`;
- geração de controllers físicos por endpoint;
- microserviços, Kubernetes, event sourcing, filas distribuídas;
- MySQL, Oracle, SQL Server;
- workflows de negócio.

---

## 3. Entidades do domínio

Modeladas em `apps/api/prisma/schema.prisma`:

| Entidade | Função |
|---|---|
| `User` | proprietário dos projetos |
| `Project` | agrupador lógico, identificado por `slug` único |
| `DatabaseConnection` | credenciais de um PostgreSQL externo, pertencente a um projeto |
| `SavedQuery` | consulta SQL associada a uma conexão |
| `QueryParameter` | parâmetro tipado e posicional de uma `SavedQuery` |
| `Endpoint` | publicação de uma `SavedQuery` como rota HTTP |
| `ApiKey` | credencial de consumo, pertencente a um projeto |
| `RequestLog` | registro técnico de execução de um endpoint |

Tipos de parâmetro suportados (`QueryParameterType`):
`STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `DATE`, `DATETIME`, `UUID`.

---

## 4. Funcionalidades previstas

1. criar e administrar projetos;
2. cadastrar conexões PostgreSQL e testá-las;
3. inspecionar a estrutura do banco conectado (schemas, tabelas, colunas, PK/FK);
4. escrever, salvar e executar consultas `SELECT` de teste;
5. definir parâmetros das consultas;
6. publicar consultas salvas como endpoints versionados;
7. consumir os endpoints por rota dinâmica;
8. proteger o consumo com API Keys;
9. acompanhar logs e métricas de execução;
10. visualizar a documentação dos endpoints publicados.

---

## 5. Contrato de consumo

Rota dinâmica planejada:

```http
GET /runtime/:projectSlug/:version/:endpointSlug
```

A URL é derivada de `Project.slug`, `Endpoint.version` e `Endpoint.slug`,
combinação garantida como única pelo índice `@@unique([projectId, version, slug])`.

Parâmetros trafegam pela query string HTTP e são convertidos para os tipos
declarados em `QueryParameter` antes de compor o array de valores enviado ao
PostgreSQL. Apenas endpoints com `isPublished = true` são executáveis.

---

## 6. Regras de segurança funcionais

- senha de banco externo nunca é persistida nem retornada em texto puro;
- API Key completa nunca é persistida; armazena-se `keyHash` e `keyPrefix`;
- consultas passam por validação própria antes da execução, não apenas por
  verificação de prefixo textual;
- valores recebidos pelo endpoint nunca são concatenados ao SQL — a execução é
  sempre parametrizada (`$1`, `$2`, ...);
- toda resposta respeita o limite definido em `Endpoint.maxRows`;
- logs registram dados técnicos, nunca credenciais ou segredos.

---

## 7. Estado atual da interface HTTP

Implementado:

```http
GET    /health
GET    /health/database

POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
```

Existe também `GET /` como resposta remanescente do scaffold do NestJS.

Ainda não implementado: conexões, introspecção, consultas salvas, endpoints,
API Keys, runtime, logs e autenticação.

---

## 8. Critério de conclusão do MVP

O MVP estará funcional quando um usuário conseguir percorrer integralmente:

```text
criar conta → criar projeto → cadastrar PostgreSQL → testar conexão →
visualizar tabelas e colunas → escrever SELECT → executar SELECT de teste →
definir parâmetros → salvar query → criar endpoint → publicar endpoint →
gerar API Key → consumir GET /runtime/projeto/v1/endpoint →
receber JSON → visualizar o log da requisição
```

Esse fluxo tem prioridade sobre qualquer funcionalidade secundária.
