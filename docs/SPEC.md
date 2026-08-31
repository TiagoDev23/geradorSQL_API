# Especificação do MVP

O que a plataforma faz e onde termina o escopo. Para como ela está construída,
ver [ARCHITECTURE](ARCHITECTURE.md); para o porquê das escolhas,
[DECISIONS](DECISIONS.md).

---

## 1. Objetivo

Ferramenta web para criação dinâmica de endpoints REST destinados à consulta e
disponibilização de grandes volumes de dados armazenados em bancos PostgreSQL.

O usuário conecta um PostgreSQL já existente, escreve consultas `SELECT`, define
parâmetros e publica essas consultas como rotas HTTP que retornam JSON. O foco é
consulta e disponibilização de dados: o projeto não é um backend builder genérico
e não pretende reproduzir Supabase, Hasura ou PostgREST.

---

## 2. Fluxo principal

```text
criar conta → criar projeto → cadastrar conexão PostgreSQL → testar conexão →
inspecionar schemas e tabelas → escrever SELECT → definir parâmetros →
executar consulta de teste → salvar → publicar como endpoint →
gerar API Key → consumir o endpoint → acompanhar logs e OpenAPI
```

Este fluxo tem prioridade sobre qualquer funcionalidade secundária.

---

## 3. Requisitos funcionais

| # | Requisito |
|---|---|
| RF01 | Cadastro e login de usuários, com sessão autenticada por JWT |
| RF02 | Criação e administração de projetos, identificados por `slug` único |
| RF03 | Cadastro, edição e teste de conexões PostgreSQL externas |
| RF04 | Introspecção do banco conectado: schemas, tabelas, views, colunas, PK, FK |
| RF05 | Consultas `SELECT` salvas, associadas a uma conexão |
| RF06 | Parâmetros tipados e posicionais por consulta |
| RF07 | Execução de teste da consulta, com limite de registros |
| RF08 | Publicação e despublicação de consultas como endpoints versionados |
| RF09 | Runtime que resolve e executa endpoints publicados por rota dinâmica |
| RF10 | API Keys por projeto, com revogação e expiração opcional |
| RF11 | Registro de execuções e métricas agregadas por projeto |
| RF12 | Especificação OpenAPI gerada dos endpoints publicados |
| RF13 | Interface web cobrindo todo o fluxo acima |

Tipos de parâmetro suportados: `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `DATE`,
`DATETIME`, `UUID`.

---

## 4. Entidades

| Entidade | Função |
|---|---|
| `User` | proprietário dos projetos |
| `Project` | agrupador lógico, identificado por `slug` único |
| `DatabaseConnection` | credenciais de um PostgreSQL externo, dentro de um projeto |
| `SavedQuery` | consulta SQL associada a uma conexão |
| `QueryParameter` | parâmetro tipado e posicional de uma `SavedQuery` |
| `Endpoint` | publicação de uma `SavedQuery` como rota HTTP |
| `ApiKey` | credencial de consumo, dentro de um projeto |
| `RequestLog` | registro técnico da execução de um endpoint |

Definidas em `apps/api/prisma/schema.prisma`.

---

## 5. Contrato de consumo

```http
GET /runtime/:projectSlug/:version/:endpointSlug
x-api-key: <api-key>
```

A URL deriva de `Project.slug`, `Endpoint.version` e `Endpoint.slug` — combinação
única por `@@unique([projectId, version, slug])`. Apenas endpoints com
`isPublished = true` são executáveis.

Os valores chegam pela query string e são convertidos para os tipos declarados em
`QueryParameter` antes de compor o array enviado ao PostgreSQL. A resposta traz
`columns`, `rows`, `rowCount`, `maxRows`, `truncated` e `durationMs`.

---

## 6. Regras de segurança funcionais

- senha de banco externo nunca é persistida nem retornada em texto puro;
- API Key completa nunca é persistida: guardam-se `keyHash` e `keyPrefix`, e o
  valor é exibido uma única vez;
- consultas passam por validação própria antes de gravar e antes de executar, não
  apenas por verificação de prefixo textual;
- valores recebidos nunca são concatenados ao SQL — a execução é sempre
  parametrizada (`$1`, `$2`, ...);
- toda resposta respeita o limite de `Endpoint.maxRows`;
- cada usuário acessa apenas os próprios recursos;
- logs registram dados técnicos, nunca credenciais, chaves ou SQL.

---

## 7. Restrições do MVP

- PostgreSQL como único SGBD suportado;
- consultas restritas a `SELECT`;
- endpoints publicados exclusivamente como `GET`;
- resposta em JSON;
- consumo autenticado por API Key; painel autenticado por JWT;
- limite de registros por endpoint, sem paginação sobre SQL arbitrário.

---

## 8. Fora do escopo

`INSERT`, `UPDATE`, `DELETE` e `PATCH`; geração de controllers por endpoint;
MySQL, Oracle e SQL Server; microserviços, Kubernetes, filas e event sourcing;
GraphQL; RBAC, organizações e equipes; rate limiting; Swagger UI embarcado
([D17](DECISIONS.md)).
