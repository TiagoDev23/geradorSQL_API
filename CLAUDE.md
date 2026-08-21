Sim. Daqui para frente podemos entregar a implementação pesada ao Claude no VS Code, porque já fizemos manualmente as decisões que eu não queria deixar uma IA improvisar: stack, monorepo, Docker, bancos, Prisma, modelo interno e fluxo básico de projeto.

O ideal agora é colocar um **`CLAUDE.md` na raiz do repositório**. Ele vira a regra permanente do projeto para o Claude Code/integração do Claude no VS Code.

Crie:

```text
C:\Meu-gerador-de-api\CLAUDE.md
```

e coloque o conteúdo abaixo.

````md
# CLAUDE.md

# Projeto — Gerador Dinâmico de APIs REST para PostgreSQL

## 1. Objetivo do projeto

Este repositório corresponde ao desenvolvimento de um Trabalho de Conclusão de Curso cujo tema é:

> Desenvolvimento de uma ferramenta web para criação dinâmica de endpoints REST destinados à consulta e disponibilização de grandes volumes de dados em bancos PostgreSQL.

A aplicação deve permitir que um usuário:

1. crie projetos;
2. cadastre conexões com bancos PostgreSQL existentes;
3. teste essas conexões;
4. visualize estruturas do banco;
5. escreva e salve consultas SQL;
6. defina parâmetros para essas consultas;
7. transforme consultas salvas em endpoints REST;
8. publique endpoints;
9. consuma esses endpoints através de uma rota dinâmica;
10. proteja os endpoints com API Keys;
11. acompanhe métricas e logs de execução;
12. visualize documentação da API criada.

O foco principal é consulta e disponibilização de dados.

Este projeto NÃO é um backend builder completo e NÃO deve tentar reproduzir ferramentas como Supabase, Hasura ou PostgREST.

---

# 2. Escopo obrigatório do MVP

O MVP deve trabalhar apenas com:

- PostgreSQL;
- consultas `SELECT`;
- endpoints HTTP `GET`;
- parâmetros de consulta;
- retorno JSON;
- API Keys;
- logs básicos;
- limitação de quantidade de registros;
- interface web;
- documentação dos endpoints;
- execução dinâmica das consultas.

Não implementar inicialmente:

- INSERT;
- UPDATE;
- DELETE;
- PATCH;
- geração de controllers físicos para cada endpoint;
- microserviços;
- Kubernetes;
- event sourcing;
- filas distribuídas;
- arquitetura excessivamente complexa;
- suporte a MySQL, Oracle ou SQL Server;
- workflows de negócio complexos.

Não expandir o escopo sem solicitação explícita.

---

# 3. Princípio arquitetural principal

A aplicação possui dois contextos de dados distintos.

## Banco interno da plataforma

Armazena os dados administrativos da ferramenta:

- usuários;
- projetos;
- conexões;
- queries;
- parâmetros;
- endpoints;
- API Keys;
- logs.

Tecnologia:

```text
NestJS
  ↓
Prisma
  ↓
PostgreSQL da plataforma
````

O Prisma deve ser utilizado SOMENTE nesse banco.

---

## Bancos PostgreSQL externos

São bancos cadastrados pelos usuários da plataforma.

Tecnologia:

```text
NestJS
  ↓
node-postgres (`pg`)
  ↓
PostgreSQL externo
```

NUNCA criar um Prisma Client dinamicamente para bancos externos.

NUNCA criar schema Prisma para o banco do usuário.

NUNCA executar migration em bancos externos.

---

# 4. Arquitetura macro

```text
Next.js
   │
   │ HTTP
   ▼
NestJS
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
        `pg`
          │
          ▼
   PostgreSQL cadastrado
   pelo usuário
```

A aplicação é um **monólito modular**.

Não converter para microserviços.

---

# 5. Estrutura atual do monorepo

```text
Meu-gerador-de-api/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── contracts/
│
├── docs/
├── infra/
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── CLAUDE.md
└── .gitignore
```

Package manager:

```text
pnpm
```

O workspace raiz é responsável por todas as aplicações.

Não criar workspaces ou lockfiles internos desnecessários.

---

# 6. Frontend

Local:

```text
apps/web
```

Stack:

* Next.js;
* React;
* TypeScript.

Servidor de desenvolvimento:

```text
http://localhost:3000
```

O frontend ainda não é prioridade.

Primeiro estabilizar os principais fluxos do backend.

Depois criar a interface web consumindo a API NestJS.

---

# 7. Backend

Local:

```text
apps/api
```

Stack:

* NestJS;
* TypeScript;
* Prisma 7;
* PostgreSQL;
* node-postgres (`pg`);
* class-validator;
* class-transformer.

Servidor:

```text
http://localhost:3001
```

Não alterar a porta padrão do projeto sem necessidade.

---

# 8. Configuração TypeScript do backend

O backend está configurado para funcionar de maneira estável com CommonJS / Node16.

Não converter novamente o projeto para ESM sem necessidade real.

Configuração essencial:

```json
{
  "module": "Node16",
  "moduleResolution": "Node16"
}
```

O `apps/api/package.json` NÃO deve possuir:

```json
"type": "module"
```

Não adicionar extensões `.js` aos imports TypeScript atuais.

---

# 9. Prisma

Versão atual:

```text
Prisma 7.9.1
```

Generator:

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}
```

Datasource:

```prisma
datasource db {
  provider = "postgresql"
}
```

A URL fica em:

```text
prisma.config.ts
```

e é obtida por:

```text
DATABASE_URL
```

Não voltar a colocar a URL diretamente no `schema.prisma`.

---

# 10. Banco interno atual

Container:

```text
gerador-api-platform-db
```

Host durante desenvolvimento:

```text
127.0.0.1
```

Porta externa:

```text
5434
```

Porta interna Docker:

```text
5432
```

Banco:

```text
gerador_api_platform
```

Usuário:

```text
gerador
```

Existe um PostgreSQL instalado diretamente no Windows utilizando a porta `5432`.

Por esse motivo NÃO alterar o container da plataforma novamente para `5432`.

---

# 11. Banco demo

Container:

```text
gerador-api-demo-db
```

Host:

```text
127.0.0.1
```

Porta externa:

```text
5433
```

Porta interna Docker:

```text
5432
```

Banco:

```text
gerador_api_demo
```

Usuário:

```text
demo
```

Esse banco deve representar apenas um banco externo conectado pelo usuário.

Não usar Prisma para acessá-lo.

Usar `pg`.

Ele servirá posteriormente para:

* testes funcionais;
* introspecção;
* Saved Queries;
* endpoints dinâmicos;
* testes de volume;
* demonstração do TCC.

---

# 12. Modelagem interna existente

A primeira migration já foi criada.

Entidades:

```text
User
Project
DatabaseConnection
SavedQuery
QueryParameter
Endpoint
ApiKey
RequestLog
```

Além de:

```text
_prisma_migrations
```

Relacionamento conceitual:

```text
User
 └── Project
      ├── DatabaseConnection
      │      └── SavedQuery
      │             ├── QueryParameter
      │             └── Endpoint
      │
      ├── Endpoint
      │      └── RequestLog
      │
      └── ApiKey
             └── RequestLog
```

Não redesenhar essas entidades sem necessidade justificada.

Se uma alteração de schema for realmente necessária:

1. explicar a necessidade;
2. alterar `schema.prisma`;
3. rodar `prisma format`;
4. rodar `prisma validate`;
5. criar migration;
6. nunca editar migration já aplicada para simular alteração posterior.

---

# 13. Segurança das conexões externas

O campo existente é:

```text
passwordEncrypted
```

A senha de banco externo NUNCA deve ser armazenada em texto puro.

Implementar criptografia autenticada usando:

```text
AES-256-GCM
```

A chave da aplicação ficará em:

```text
CONNECTION_ENCRYPTION_KEY
```

Ela deve possuir 32 bytes.

Armazenar junto ao ciphertext os elementos necessários para descriptografia, como:

* IV;
* authentication tag;
* ciphertext.

A chave principal nunca vai para o banco.

Nunca retornar `passwordEncrypted` pelas APIs públicas.

---

# 14. API Keys

Nunca armazenar API Keys completas no banco.

Fluxo esperado:

```text
gerar token criptograficamente seguro
         ↓
mostrar token apenas uma vez
         ↓
calcular hash
         ↓
armazenar keyHash
```

Também armazenar:

```text
keyPrefix
```

para identificação visual.

Exemplo:

```text
gapi_a83f...
```

Campos previstos:

* keyHash;
* keyPrefix;
* expiresAt;
* revokedAt;
* lastUsedAt.

---

# 15. Runtime dinâmico

Essa é uma das regras arquiteturais mais importantes.

NÃO gerar arquivos como:

```text
produto.controller.ts
clientes.controller.ts
estoque.controller.ts
```

cada vez que o usuário publica um endpoint.

O runtime deve resolver endpoints dinamicamente.

Formato planejado:

```http
GET /runtime/:projectSlug/:version/:endpointSlug
```

Exemplo:

```http
GET /runtime/farmacia-demo/v1/produtos
```

Fluxo:

```text
requisição
    ↓
resolver projectSlug
    ↓
resolver version + endpointSlug
    ↓
buscar Endpoint
    ↓
buscar SavedQuery
    ↓
buscar QueryParameters
    ↓
buscar DatabaseConnection
    ↓
descriptografar credencial
    ↓
validar parâmetros
    ↓
executar SQL parametrizado via pg
    ↓
aplicar limite
    ↓
retornar JSON
    ↓
registrar RequestLog
```

Essa rota deve ser genérica.

---

# 16. Segurança SQL

A plataforma deve trabalhar somente com consultas permitidas.

MVP:

```text
SELECT
```

Bloquear:

* INSERT;
* UPDATE;
* DELETE;
* DROP;
* ALTER;
* TRUNCATE;
* CREATE;
* GRANT;
* REVOKE;
* COPY perigoso;
* múltiplas instruções quando não forem necessárias.

Não confiar apenas em:

```ts
sql.trim().startsWith('SELECT')
```

Criar uma camada própria de validação de SQL.

Nunca concatenar parâmetros recebidos pelo endpoint diretamente na query.

Obrigatório:

```sql
WHERE categoria_id = $1
```

e valores:

```ts
[3]
```

Não:

```ts
"WHERE categoria_id = " + categoriaId
```

---

# 17. SavedQuery e parâmetros

Exemplo:

```sql
SELECT
  id,
  nome,
  preco
FROM produtos
WHERE categoria_id = $1
  AND preco <= $2
```

Parâmetros associados:

```text
categoriaId
type = INTEGER
position = 1

precoMaximo
type = FLOAT
position = 2
```

O runtime deve montar:

```text
values = [categoriaId, precoMaximo]
```

e executar com `pg`.

Tipos inicialmente suportados:

* STRING;
* INTEGER;
* FLOAT;
* BOOLEAN;
* DATE;
* DATETIME;
* UUID.

---

# 18. Endpoints

No MVP todo endpoint publicado corresponde a:

```http
GET
```

Não adicionar campo `method` apenas para armazenar `GET`.

URL derivada de:

```text
project.slug
endpoint.version
endpoint.slug
```

Formato:

```text
/runtime/{projectSlug}/{version}/{endpointSlug}
```

`Endpoint` referencia `SavedQuery`.

Não duplicar SQL dentro de `Endpoint`.

---

# 19. Limitação de resultados

O modelo Endpoint possui:

```text
maxRows
```

O runtime deve impedir retorno ilimitado de dados.

Mesmo se a consulta original não possuir `LIMIT`, aplicar política segura.

Não confiar apenas no usuário para limitar volume.

Implementar posteriormente paginação quando apropriado.

---

# 20. Módulos NestJS

Já existentes:

```text
ConfigModule       ✅
PrismaModule       ✅
HealthModule       ✅
ProjectsModule     ✅
```

Criar gradualmente:

```text
CryptoModule
DatabaseConnectionsModule
DatabaseIntrospectionModule
SavedQueriesModule
QueryParametersModule ou lógica subordinada ao SavedQuery
EndpointsModule
ApiKeysModule
RuntimeModule
RequestLogsModule
AuthModule
```

Não é obrigatório criar um módulo separado se ele não agregar isolamento real.

Evitar abstrações sem uso.

---

# 21. ProjectsModule existente

Já existe implementação CRUD básica.

Funcionalidades testadas:

```text
POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
```

Existe normalização automática de slug.

Exemplo:

```text
Farmácia Demo
→ farmacia-demo
```

Existe temporariamente um `ownerId` recebido pelo DTO porque autenticação ainda não foi implementada.

Quando `AuthModule` estiver funcional, remover `ownerId` controlado pelo cliente e obter usuário através da autenticação.

Não quebrar o ProjectsModule funcional durante outras etapas.

---

# 22. Usuário temporário de desenvolvimento

Existe um usuário de desenvolvimento utilizado apenas enquanto o AuthModule não existe.

ID:

```text
00000000-0000-4000-8000-000000000001
```

Esse usuário não representa o fluxo definitivo.

Não basear funcionalidades permanentes nesse ID.

---

# 23. DatabaseConnection — próximo fluxo obrigatório

Implementar cadastro de conexões pertencentes a um projeto.

Dados:

* name;
* host;
* port;
* databaseName;
* defaultSchema;
* username;
* password;
* sslMode;
* projectId.

A API recebe:

```text
password
```

mas persiste:

```text
passwordEncrypted
```

Nunca retornar:

```text
password
passwordEncrypted
```

Endpoint previsto:

```http
POST /projects/:projectId/connections
```

Listagem:

```http
GET /projects/:projectId/connections
```

Detalhe:

```http
GET /connections/:id
```

Atualização:

```http
PATCH /connections/:id
```

Exclusão:

```http
DELETE /connections/:id
```

Teste:

```http
POST /connections/:id/test
```

O teste deve:

1. buscar conexão;
2. descriptografar senha;
3. abrir conexão temporária usando `pg`;
4. executar algo simples como:

```sql
SELECT 1
```

5. opcionalmente consultar:

```sql
SELECT current_database(), current_user
```

6. fechar o cliente/pool obrigatoriamente;
7. retornar resultado seguro.

Timeout obrigatório para conexão.

Não deixar pools temporários abertos.

---

# 24. Database Introspection

Depois das conexões, implementar introspecção PostgreSQL.

O sistema deve conseguir consultar pelo menos:

* schemas;
* tabelas;
* views;
* colunas;
* tipos;
* nullable;
* primary keys;
* foreign keys;
* relacionamentos básicos.

Preferir:

```text
information_schema
```

e `pg_catalog` quando necessário.

Não armazenar toda a estrutura imediatamente no banco interno se não houver necessidade.

Primeiro permitir introspecção sob demanda.

Endpoints possíveis:

```http
GET /connections/:id/schemas
GET /connections/:id/tables
GET /connections/:id/tables/:schema/:table
```

Retornar estruturas JSON próprias e estáveis.

---

# 25. SavedQuery

Criar fluxo para:

```text
criar query
editar query
excluir query
listar queries
executar teste da query
```

Uma SavedQuery pertence a uma DatabaseConnection.

Endpoints sugeridos:

```http
POST /connections/:connectionId/queries
GET  /connections/:connectionId/queries
GET  /queries/:id
PATCH /queries/:id
DELETE /queries/:id
POST /queries/:id/execute
```

O teste de query deve:

* validar SQL;
* validar parâmetros;
* conectar ao banco correto;
* executar via `pg`;
* aplicar limite;
* retornar colunas/linhas;
* retornar tempo de execução;
* fechar recursos corretamente.

---

# 26. Endpoint publication

Implementar publicação de uma SavedQuery como Endpoint.

Campos relevantes:

* name;
* description;
* slug;
* version;
* maxRows;
* isPublished;
* publishedAt;
* projectId;
* savedQueryId.

Quando publicar:

```text
isPublished = true
publishedAt = data atual
```

Quando despublicar:

```text
isPublished = false
```

O runtime só deve executar endpoints publicados.

---

# 27. Runtime

Implementar apenas depois de conexão + SavedQuery + parâmetros + Endpoint estarem estáveis.

Rota:

```http
GET /runtime/:projectSlug/:version/:endpointSlug
```

Responsabilidades:

1. localizar projeto;
2. localizar endpoint publicado;
3. carregar SavedQuery;
4. carregar parâmetros ordenados por `position`;
5. converter query string HTTP para tipos corretos;
6. validar campos obrigatórios;
7. autenticar API Key quando exigido;
8. conectar ao banco externo;
9. executar query parametrizada;
10. limitar resultado;
11. medir duração;
12. retornar JSON;
13. gerar RequestLog.

---

# 28. Logs

Registrar dados técnicos, não dados sensíveis.

RequestLog deve possuir:

* endpointId;
* apiKeyId, quando aplicável;
* statusCode;
* durationMs;
* rowCount;
* errorCode;
* createdAt.

Nunca registrar:

* senhas;
* API Key completa;
* connection string completa;
* secrets;
* conteúdo sensível sem necessidade.

---

# 29. Auth

Autenticação administrativa pode ser implementada depois do fluxo central.

Quando implementar:

* cadastro;
* login;
* senha com hash seguro;
* JWT;
* guard global ou apropriado;
* usuário identificado através do token.

Não armazenar senha em texto puro.

Após autenticação:

* Project deve pertencer ao usuário autenticado;
* `ownerId` deixa de vir do body;
* impedir acesso a projetos de outros usuários.

---

# 30. Frontend futuro

O frontend deve permitir no mínimo:

## Dashboard

* listar projetos;
* criar projeto;
* editar projeto.

## Projeto

* conexões;
* queries;
* endpoints;
* API Keys;
* métricas.

## Conexão

Formulário:

```text
Nome
Host
Porta
Banco
Schema
Usuário
Senha
SSL
```

Botão:

```text
Testar conexão
```

## Explorer

Mostrar:

```text
schemas
 └── tabelas
      └── colunas
```

## Query Editor

Usar Monaco Editor.

Permitir:

* escrever SQL;
* executar teste;
* visualizar resultados;
* cadastrar parâmetros;
* salvar.

## Endpoint

Configurar:

* nome;
* slug;
* versão;
* query;
* maxRows;
* publicação.

Mostrar URL final.

## Docs

Mostrar:

* método;
* URL;
* parâmetros;
* exemplo;
* resposta.

---

# 31. Contratos compartilhados

Existe:

```text
packages/contracts
```

Usar quando houver contratos genuinamente compartilhados entre web e API.

Não duplicar interfaces se houver benefício claro em compartilhar.

Porém não criar abstrações prematuras.

---

# 32. Testes

Toda funcionalidade relevante deve possuir testes.

Prioridades:

1. services;
2. validação SQL;
3. CryptoService;
4. transformação de parâmetros;
5. runtime;
6. segurança;
7. controllers críticos.

Antes de considerar uma tarefa concluída:

```bash
pnpm --filter api build
```

e executar testes relevantes.

Não declarar uma funcionalidade como pronta se o TypeScript não compilar.

---

# 33. Tratamento de erros

Usar exceptions adequadas do NestJS:

```text
BadRequestException
NotFoundException
ConflictException
UnauthorizedException
ForbiddenException
ServiceUnavailableException
```

Não retornar erro bruto do PostgreSQL ao cliente.

Erros de conexão devem resultar em mensagens seguras.

Por exemplo:

```json
{
  "statusCode": 400,
  "message": "Não foi possível conectar ao banco informado."
}
```

Detalhes técnicos podem ir para log de desenvolvimento, nunca credenciais.

---

# 34. Convenções de código

Usar:

* TypeScript strict;
* DTOs;
* ValidationPipe;
* dependency injection;
* modules NestJS;
* services;
* controllers finos;
* responsabilidades bem separadas.

Evitar:

* `any`;
* funções gigantes;
* regra de negócio em controller;
* duplicação;
* magic strings repetidas;
* arquivos enormes;
* abstrações sem necessidade.

DTO obrigatório:

```ts
name!: string;
```

para propriedades obrigatórias quando `strictPropertyInitialization` exigir.

---

# 35. Regras para o Claude

Antes de modificar qualquer parte:

1. ler este arquivo;
2. inspecionar a implementação existente;
3. identificar o que já existe;
4. não recriar o que funciona;
5. verificar schema/migrations atuais;
6. verificar scripts do package.json;
7. fazer alterações incrementais.

Nunca assumir que um arquivo não existe sem verificar.

Nunca substituir grandes áreas funcionais apenas porque outra implementação parece mais elegante.

Preservar decisões arquiteturais existentes.

---

# 36. Processo obrigatório para cada tarefa

Para cada etapa:

## Antes

* analisar arquivos existentes;
* explicar brevemente o plano;
* identificar arquivos que serão alterados.

## Durante

* implementar somente o necessário;
* preservar compatibilidade;
* seguir arquitetura existente.

## Depois

Executar quando aplicável:

```bash
pnpm --filter api build
```

```bash
pnpm --filter api test
```

Para alterações Prisma:

```bash
pnpm --filter api exec prisma format
pnpm --filter api exec prisma validate
pnpm --filter api exec prisma generate
```

Se schema mudar:

```bash
pnpm --filter api exec prisma migrate dev --name <nome>
```

Verificar erros antes de concluir.

---

# 37. Não fazer automaticamente

Claude NÃO deve:

* mudar stack;
* trocar Prisma;
* trocar NestJS;
* trocar PostgreSQL;
* trocar pnpm;
* converter para microserviços;
* converter CommonJS/Node16 novamente para ESM;
* alterar portas sem razão;
* apagar migrations;
* apagar volumes Docker;
* recriar banco;
* resetar banco;
* alterar schema indiscriminadamente;
* instalar biblioteca quando Node/Nest já oferece solução adequada;
* mudar arquitetura sem explicar;
* implementar features fora do MVP.

Ações destrutivas devem ser explicitamente justificadas.

---

# 38. Estado atual

Infraestrutura:

```text
Monorepo pnpm           OK
Git raiz                OK
Next.js                 OK
NestJS                  OK
Docker                  OK
PostgreSQL platform     OK
PostgreSQL demo         OK
Prisma                  OK
Migration inicial       OK
Health check            OK
ProjectsModule          OK
```

Rotas existentes importantes:

```http
GET /health
GET /health/database

POST   /projects
GET    /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
```

Projeto de demonstração existente:

```text
Farmácia Demo
slug: farmacia-demo
```

---

# 39. O que ainda falta

Implementação principal pendente:

```text
[ ] CryptoService
[ ] DatabaseConnectionsModule
[ ] teste de conexão externa
[ ] introspecção PostgreSQL
[ ] banco demo com estrutura real
[ ] SavedQueriesModule
[ ] QueryParameters
[ ] validação segura de SELECT
[ ] execução de query de teste
[ ] EndpointsModule
[ ] publicação/despublicação
[ ] ApiKeysModule
[ ] RuntimeModule
[ ] RequestLogs
[ ] limites/paginação
[ ] OpenAPI/Swagger
[ ] AuthModule
[ ] autorização por proprietário
[ ] frontend
[ ] dashboard
[ ] explorer do banco
[ ] Monaco SQL editor
[ ] tela de endpoints
[ ] documentação
[ ] métricas
[ ] testes automatizados completos
[ ] Dockerização final das aplicações
[ ] documentação técnica
[ ] testes de desempenho
```

---

# 40. Ordem de implementação

Seguir preferencialmente:

## M1 — Connections

* CryptoService;
* CRUD de DatabaseConnection;
* teste de conexão com `pg`;
* ocultação de secrets.

## M2 — Introspection

* schemas;
* tabelas;
* colunas;
* PK/FK;
* relacionamentos.

## M3 — Banco Demo

Criar estrutura suficientemente rica para demonstração:

```text
categorias
produtos
estoque
clientes
fornecedores
pedidos
itens_pedido
funcionarios
```

Com PKs, FKs, índices e volume inicial de dados.

## M4 — Saved Queries

* CRUD;
* parâmetros;
* validação;
* execução de teste;
* resultados limitados.

## M5 — Endpoint Management

* CRUD;
* publicação;
* slug/version;
* maxRows.

## M6 — Runtime

```http
GET /runtime/:projectSlug/:version/:endpointSlug
```

Executar SavedQuery dinamicamente.

## M7 — API Keys

* criação;
* hash;
* revogação;
* expiração;
* autenticação no runtime.

## M8 — Logs e métricas

* duração;
* status;
* linhas;
* erros.

## M9 — Auth

* cadastro/login;
* JWT;
* ownership.

## M10 — OpenAPI / documentação

Gerar documentação dos endpoints publicados.

## M11 — Frontend

Construir interface completa.

## M12 — Qualidade e avaliação

* testes;
* performance;
* segurança;
* documentação;
* preparação da demonstração do TCC.

---

# 41. Critério de conclusão do MVP

O MVP estará funcional quando um usuário conseguir executar este fluxo:

```text
Criar conta
    ↓
Criar projeto
    ↓
Cadastrar PostgreSQL
    ↓
Testar conexão
    ↓
Visualizar tabelas/colunas
    ↓
Escrever SELECT
    ↓
Executar SELECT de teste
    ↓
Definir parâmetros
    ↓
Salvar query
    ↓
Criar endpoint
    ↓
Publicar endpoint
    ↓
Gerar API Key
    ↓
Consumir:
GET /runtime/projeto/v1/endpoint
    ↓
Receber JSON
    ↓
Visualizar log da requisição
```

Esse fluxo possui prioridade sobre funcionalidades secundárias.

````

### Também crie estes arquivos

Vale muito a pena criar três documentos curtos em `docs/` para o Claude ter contexto sem transformar o `CLAUDE.md` em documentação do sistema:

```text
docs/
├── SPEC.md
├── ARCHITECTURE.md
└── DECISIONS.md
````

Não precisamos preencher tudo manualmente. O próprio Claude pode fazer isso **com base no repositório e no `CLAUDE.md`**, desde que seja instruído a não inventar decisões.

## Primeiro prompt para enviar ao Claude no VS Code

Depois de abrir:

```text
C:\Meu-gerador-de-api
```

no VS Code e conectar o Claude ao repositório, eu começaria **não pedindo código imediatamente**, mas com este prompt:

```text
Leia integralmente o CLAUDE.md na raiz deste repositório antes de fazer qualquer alteração.

Depois faça uma auditoria do estado atual do projeto.

Você deve:

1. inspecionar a estrutura completa do monorepo;
2. analisar apps/api;
3. analisar apps/web;
4. analisar packages/contracts;
5. analisar docker-compose.yml;
6. analisar os package.json;
7. analisar pnpm-workspace.yaml;
8. analisar o schema.prisma;
9. analisar prisma.config.ts;
10. analisar migrations existentes;
11. analisar os módulos NestJS existentes;
12. analisar o ProjectsModule já implementado;
13. analisar HealthModule e PrismaModule;
14. verificar a configuração TypeScript/CommonJS/Node16;
15. verificar as variáveis esperadas sem revelar secrets;
16. executar os comandos de build e testes que forem seguros;
17. comparar o estado real encontrado com a seção "O que ainda falta" do CLAUDE.md.

NÃO altere código nesta primeira etapa.

Crie ou atualize apenas documentação em:

docs/SPEC.md
docs/ARCHITECTURE.md
docs/DECISIONS.md

A documentação deve refletir o que realmente existe no código e as decisões presentes no CLAUDE.md.

Depois apresente:

- o que já está pronto;
- o que está parcialmente pronto;
- o que ainda não existe;
- problemas técnicos encontrados;
- inconsistências entre código e CLAUDE.md;
- plano de implementação recomendado seguindo M1 a M12.

Não proponha mudança de stack.
Não proponha microserviços.
Não converta o backend para ESM.
Não apague migrations ou bancos.
Não faça refatorações grandes nesta etapa.

Pare após a auditoria e aguarde minha autorização para começar o M1.
```

Esse primeiro passo é importante porque faz o Claude **ler o código real antes de sair escrevendo**.

Depois que ele terminar a auditoria, o segundo comando será aproximadamente:

```text
Implemente o M1 — Connections conforme o CLAUDE.md e o plano aprovado.

Antes de codificar, liste os arquivos que serão criados ou modificados.

Implemente:
- CryptoService usando AES-256-GCM;
- configuração CONNECTION_ENCRYPTION_KEY;
- CreateDatabaseConnectionDto;
- UpdateDatabaseConnectionDto;
- DatabaseConnectionsService;
- DatabaseConnectionsController;
- DatabaseConnectionsModule;
- criptografia de password antes de persistir;
- nenhuma exposição de passwordEncrypted;
- CRUD de conexões;
- POST /connections/:id/test;
- conexão externa exclusivamente por pg;
- timeout;
- fechamento garantido de cliente/pool;
- tratamento seguro de erros;
- testes unitários relevantes.

Use o PostgreSQL demo na porta 5433 apenas como cenário de teste.

Ao final:
- execute build;
- execute testes;
- informe arquivos alterados;
- informe comandos executados;
- informe resultado dos testes;
- não avance para M2 automaticamente.

Pare e aguarde validação.
```

### Daqui em diante

Nosso trabalho fica dividido de uma maneira boa:

```text
Nós
│
├── decisões arquiteturais ✅
├── definição do escopo ✅
├── banco/modelagem ✅
├── revisão das entregas
└── direcionamento do TCC

Claude no VS Code
│
├── implementação pesada
├── criação dos módulos
├── testes
├── refatorações locais
└── documentação do código
```

**não implementar M1 até M12 de uma vez**. O `CLAUDE.md` contém o projeto inteiro, mas faça **um milestone por vez**. Assim conseguimos testar `Connection → Introspection → SavedQuery → Runtime` progressivamente e não terminamos com milhares de linhas.



# 42. Relatório de desenvolvimento para o TCC

O desenvolvimento deste projeto também será utilizado como evidência e base para a escrita do Trabalho de Conclusão de Curso.

Por isso, após concluir cada milestone relevante, atualizar obrigatoriamente:

docs/DEVELOPMENT_REPORT.md

O objetivo desse arquivo NÃO é funcionar como changelog técnico detalhado.

Ele deve registrar apenas informações relevantes para posterior escrita acadêmica do TCC.

## Quando atualizar

Atualizar após a conclusão de etapas relevantes, como:

- configuração da arquitetura;
- criação ou alteração importante do banco interno;
- Database Connections;
- introspecção;
- Saved Queries;
- validação SQL;
- criação de endpoints;
- Runtime;
- API Keys;
- logs;
- autenticação;
- frontend;
- testes de desempenho;
- testes de segurança;
- deploy;
- conclusão do MVP.

Não criar uma entrada para pequenas correções, lint, formatação ou ajustes triviais.

---

## Estrutura obrigatória de cada registro

Usar:

### [DATA] — Nome da etapa

**Objetivo**

Explicar brevemente o que esta etapa pretendia implementar.

**Implementação realizada**

Descrever de maneira clara e objetiva o que foi desenvolvido.

Evitar listar todos os arquivos individualmente.

Priorizar funcionalidades e decisões relevantes.

**Decisões técnicas**

Registrar apenas decisões que possam ser justificadas posteriormente no TCC.

Exemplos:

- utilização de Prisma exclusivamente no banco interno;
- utilização de `pg` para bancos externos;
- escolha de AES-256-GCM para credenciais;
- utilização de runtime dinâmico;
- consultas limitadas a SELECT;
- estratégia de parametrização;
- definição de limites de resultados.

**Funcionamento**

Descrever resumidamente o fluxo implementado.

Exemplo:

Usuário cadastra conexão
→ credencial é criptografada
→ configuração é persistida
→ backend utiliza `pg`
→ conexão externa é testada
→ resultado seguro é retornado.

**Validação realizada**

Registrar testes realmente executados.

Exemplos:

- build;
- testes unitários;
- teste de integração;
- conexão com banco demo;
- execução de consulta;
- teste de endpoint;
- medição de desempenho.

Nunca afirmar que algo foi testado se não tiver sido efetivamente executado.

**Resultado**

Informar objetivamente o estado final da etapa.

Exemplo:

> A aplicação passou a permitir o cadastro e teste de conexões PostgreSQL externas sem persistir credenciais em texto puro.

**Problemas encontrados e soluções**

Registrar apenas problemas tecnicamente relevantes.

Quando houver, explicar:

- problema;
- causa;
- solução aplicada.

Não registrar erros triviais de digitação ou desenvolvimento que não tenham relevância para o trabalho.

**Possível utilização no TCC**

Indicar brevemente em qual parte da monografia essa informação poderá ser aproveitada.

Exemplos:

- metodologia;
- arquitetura da solução;
- implementação;
- segurança;
- resultados;
- avaliação de desempenho.

---

## Regras de escrita

O relatório deve:

- ser direto;
- ser técnico;
- ser compreensível posteriormente;
- utilizar português brasileiro;
- evitar linguagem informal;
- evitar exageros;
- evitar afirmações não comprovadas;
- separar fatos de decisões planejadas;
- registrar somente aquilo que realmente foi implementado;
- não inventar métricas;
- não inventar testes;
- não inventar resultados.

Não incluir:

- código-fonte completo;
- logs enormes;
- stack traces;
- listas de todos os arquivos alterados;
- mensagens de commit;
- detalhes irrelevantes para o TCC.

Quando números forem relevantes, registrar os valores reais.

Exemplo:

- tempo de execução;
- quantidade de registros;
- tamanho da base;
- número de requisições;
- taxa de erro;
- uso de memória;
- tempo médio de resposta.

Esses valores poderão posteriormente ser utilizados na seção de resultados.

---

## Preservação do histórico

Nunca apagar registros anteriores do DEVELOPMENT_REPORT.md.

Sempre acrescentar novas etapas ao final.

Se uma decisão anterior for alterada, registrar uma nova entrada explicando:

- decisão anterior;
- motivo da alteração;
- nova decisão.

Não reescrever o histórico para fazê-lo parecer linear.

O histórico real das decisões é relevante para documentar o processo de desenvolvimento.

---

## Relação com Git

Quando uma milestone for considerada concluída:

1. executar validações apropriadas;
2. atualizar `docs/DEVELOPMENT_REPORT.md`;
3. garantir que o relatório corresponda ao código realmente existente;
4. incluir o relatório no mesmo commit ou PR da milestone quando apropriado.

Não registrar como concluída uma funcionalidade que ainda não exista no código.