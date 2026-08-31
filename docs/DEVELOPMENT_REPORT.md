# Relatório de desenvolvimento

Histórico resumido da implementação, por etapa, com os resultados relevantes.
Para o que o sistema faz, ver [SPEC](SPEC.md); para como está construído,
[ARCHITECTURE](ARCHITECTURE.md); para o porquê das escolhas,
[DECISIONS](DECISIONS.md).

O desenvolvimento seguiu milestones incrementais: cada etapa foi validada antes
da seguinte, com build, verificação de tipos, lint e testes automatizados.

---

## Fundação — arquitetura, monorepo e banco interno

Definição do monólito modular com dois contextos de dados, monorepo pnpm
(`apps/api`, `apps/web`, `packages/contracts`) e dois containers PostgreSQL com
volume nomeado e healthcheck: a plataforma em 5434 e o banco de demonstração em
5435, ambos mapeados para 5432 internamente.

Modelagem do banco interno com as oito entidades do domínio e migration inicial
aplicada. Implementação de `HealthModule`, `ProjectsModule` (CRUD com slug
normalizado no servidor) e `CryptoService` com AES-256-GCM.

**Resultado.** Base funcional com projetos administráveis e criptografia de
credenciais pronta para o cadastro de conexões.

---

## M1 — Database Connections

CRUD de conexões PostgreSQL por projeto, com senha cifrada antes de persistir e
`passwordEncrypted` nunca exposto por API. Teste de conectividade em
`POST /connections/:id/test`, com timeout e encerramento garantido do cliente.

Um defeito no `CryptoService` foi encontrado pelos próprios testes: o valor
cifrado de uma string vazia era recusado na decifragem.

**Resultado.** 28 testes em 3 arquivos. A plataforma passou a cadastrar e testar
bancos externos sem persistir credenciais em texto puro.

---

## M2 — Introspecção

Consulta de schemas, tabelas, views, colunas, chaves primárias e estrangeiras sob
demanda, sem espelhar a estrutura no banco interno. As consultas usam
`pg_catalog` em vez de `information_schema`, por precisarem da ordem das colunas
em chaves compostas e do tipo formatado da coluna. Schema e tabela viajam sempre
como parâmetros posicionais.

Surgiu aqui o `ExternalDatabaseService`, ponto único de acesso a bancos externos:
decifra a credencial, aplica timeouts, encerra o cliente e converte erros do
PostgreSQL em respostas seguras.

**Resultado.** 36 testes em 4 arquivos.

---

## M3 — Banco de demonstração

Substituição da base inicial de produtos por um domínio meteorológico com três
schemas (`referencia`, `meteorologia`, `impactos`), nove tabelas, duas views,
chave primária composta e sete das nove chaves estrangeiras cruzando schemas.
Estrutura e carga criados por scripts SQL próprios, sem Prisma.

O seed dependia de identificadores absolutos e produzia junções vazias após um
rollback ter avançado as sequências; passou a resolver os vínculos por
`row_number()`.

**Resultado.** 43.200 observações horárias (90 estações × 20 dias × 24 horas).
Estrutura documentada em [METEOROLOGY_DATABASE](METEOROLOGY_DATABASE.md).

---

## M4 — Consultas salvas

CRUD de `SavedQuery` com parâmetros tipados e posicionais, validação de SQL
restrita a leitura e execução de teste com limite de registros.

A validação normaliza comentários, literais, dollar quoting e identificadores
entre aspas antes de analisar o texto restante, de modo que um comando escondido
após um comentário não escape e uma palavra reservada dentro de um literal não
bloqueie indevidamente. A correspondência entre marcadores do SQL e parâmetros
declarados é verificada nos dois sentidos.

**Resultado.** 144 testes em 8 arquivos.

---

## M5 — Publicação de endpoints

CRUD de `Endpoint` com slug, versão e `maxRows`, mais publicação e despublicação.
O endpoint referencia a consulta e não copia o SQL. A consulta é revalidada no
momento da publicação, e um endpoint publicado precisa ser despublicado antes de
ser removido.

**Resultado.** 198 testes em 11 arquivos.

---

## M6 — Runtime dinâmico

Rota única `GET /runtime/:projectSlug/:version/:endpointSlug`, que resolve o
endpoint em tempo de requisição. Nenhum arquivo é gerado por publicação.

A execução foi extraída para uma função compartilhada pelo runtime e pela
execução de teste do painel, para que as garantias de segurança não divirjam
entre os dois caminhos. O limite envolve a consulta original sem reescrevê-la.

**Resultado.** 216 testes.

---

## M7 e M8 — API Keys, logs e métricas

Chaves com 32 bytes de entropia, prefixo `gapi_`, valor completo exibido uma
única vez e apenas hash persistido. Revogação, expiração e verificação de escopo
por projeto. Registro de execuções em `RequestLog` e métricas agregadas.

O endpoint é resolvido antes da autenticação para que uma falha de chave possa
ser registrada com o endpoint que se tentou acessar. O registro é
deliberadamente estreito: identificadores, status, duração e contagem de linhas —
nunca chave, parâmetros, credenciais ou SQL.

**Resultado.** 263 testes em 14 arquivos.

---

## M9 — Autenticação e ownership

Cadastro e login com senha derivada por scrypt, JWT e guard global com rotas
públicas marcadas explicitamente. Toda a cadeia de posse passou a ser verificada,
e recursos de outro proprietário respondem 404 em vez de 403.

`ownerId` deixou de vir do corpo da requisição. Projetos criados antes desta
etapa pertencem ao usuário de desenvolvimento e ficaram inacessíveis pelo painel;
o runtime continua atendendo, por depender de API Key.

**Resultado.** 307 testes em 16 arquivos.

---

## M10 — OpenAPI dinâmico

`GET /projects/:projectId/openapi` gera a especificação a partir dos endpoints
publicados: caminhos, parâmetros tipados, esquema de segurança `x-api-key` e
respostas. Nenhuma dependência foi adicionada e o SQL não entra no documento.

Um endpoint cadastrado com a aplicação em execução não aparece enquanto está
despublicado e passa a aparecer após a publicação, sem alteração de código.

**Resultado.** 332 testes em 17 arquivos.

---

## M11 — Interface web

Painel Next.js cobrindo todo o fluxo: cadastro e login, projetos, conexões com
teste e exploração da estrutura, editor de consultas com parâmetros e execução,
endpoints com publicação, API Keys, logs, métricas e OpenAPI.

O acesso à API ficou concentrado em um único módulo — URL base, cabeçalho de
autenticação e tradução de erro. O editor SQL usa CodeMirror 6 em vez do Monaco
previsto no planejamento ([D18](DECISIONS.md)). Nenhum campo sensível chega à
interface.

A única alteração no backend foi habilitar CORS, necessário porque o painel roda
em outra origem.

**Resultado.** 332 testes no backend e 25 no painel. Fluxo validado ponta a ponta
pela interface, da conexão à requisição autenticada no endpoint publicado.

---

## M12 — Qualidade, avaliação e fechamento

Nenhuma funcionalidade nova. As aplicações passaram a ser containerizáveis, com
imagens multi-stage para API e painel, `.dockerignore` e os serviços `api` e
`web` no compose. A API aplica `prisma migrate deploy` na inicialização
([D19](DECISIONS.md)).

A cobertura cresceu nos pontos de risco: o executor compartilhado por runtime e
execução de teste ganhou spec própria, e a leitura de `CORS_ORIGINS` virou função
testada que descarta entradas vazias e curinga.

Duas correções concretas: `start:prod` apontava para `dist/main` enquanto o build
gera `dist/src/main.js`, e `CORS_ORIGINS=""` produzia uma origem em branco na
lista de permitidas.

**Resultado.** 361 testes no backend em 19 arquivos e 25 no painel.

---

## Verificações de segurança do fechamento

Valores como `' OR 1=1 --`, `1; DROP TABLE ...` e `abc'); DELETE FROM ...`
chegam ao driver como parâmetros e não aparecem no texto enviado ao PostgreSQL.
`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE` e múltiplas
instruções são recusados na revalidação feita no momento da execução. Valor de
tipo incorreto e parâmetro obrigatório ausente falham antes de abrir conexão.

Casos de falha conferidos no runtime: sem chave 401, chave inválida 401, chave
revogada 401, parâmetro ausente 400, parâmetro de tipo inválido 400, endpoint
inexistente 404. No control plane: sem JWT 401, JWT inválido 401.

Isolamento entre usuários verificado por HTTP em nove recursos — projeto,
conexão, introspecção, consulta, endpoint, API Key, logs, métricas e OpenAPI: o
segundo usuário recebeu 404 em todos e nenhum projeto na listagem. Os registros
de execução não contêm a API Key nem o SQL.

Nenhuma auditoria externa foi realizada.

---

## Avaliação de desempenho

Executada em **ambiente local**, com cliente, API e os dois PostgreSQL na mesma
máquina, sobre a stack containerizada. 200 requisições por cenário, concorrência
10, após aquecimento de 20 requisições. Os números descrevem esse ambiente e não
representam capacidade de produção.

| Cenário | req/s | Média | p50 | p95 | p99 | Linhas | Falhas |
|---|---|---|---|---|---|---|---|
| A — filtro indexável | 103,9 | 95,1 ms | 93,5 ms | 134,4 ms | 144,2 ms | 137 | 0 |
| B — JOIN | 75,0 | 131,1 ms | 128,7 ms | 167,3 ms | 205,5 ms | 1000 (truncado) | 0 |
| C — agregação | 55,7 | 178,0 ms | 162,7 ms | 301,2 ms | 327,3 ms | 540 | 0 |

O cenário B alcançou o limite configurado do endpoint e retornou
`truncated: true`, confirmando o corte. As 600 requisições foram registradas como
`RequestLog` e apareceram nas métricas do projeto.

Script em `infra/benchmark/runtime-benchmark.mjs`, sem dependências adicionais.

---

## Estado final

O MVP sobe por `docker compose up --build -d`, com o painel em
`http://localhost:3000` e a API em `http://localhost:3001`. O fluxo completo —
conectar, inspecionar, consultar, publicar, proteger, consumir e observar — foi
executado ponta a ponta nessa configuração, com a conexão de demonstração
cadastrada pelo nome do serviço da rede Docker.

Limitações conscientes: PostgreSQL como único SGBD; runtime restrito a `GET`
sobre `SELECT`; sem paginação sobre SQL arbitrário; sem rate limiting; sem
Swagger UI embarcado; sem pipeline de integração contínua.
