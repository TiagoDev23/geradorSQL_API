# Relatório de desenvolvimento

Registro das etapas do desenvolvimento da ferramenta, destinado a servir de base
para a escrita do Trabalho de Conclusão de Curso. Não é um changelog: apenas
etapas relevantes são registradas, com objetivo, decisões técnicas,
funcionamento, validação realizada e resultado.

**Nota sobre as sete primeiras entradas.** Foram redigidas retrospectivamente em
2026-08-21, a partir do estado real do repositório e do histórico Git disponível
(commits `5ff82ce` e `b756c7d`, ambos de 2026-08-21), após a implementação das
etapas correspondentes. As validações descritas em cada entrada indicam
explicitamente o que foi efetivamente executado e o que não foi verificado.

Registros anteriores nunca devem ser apagados. Novas etapas são acrescentadas ao
final do documento.

---

### [2026-08-21] — Definição da arquitetura da solução

**Objetivo**

Estabelecer, antes da implementação, a arquitetura da ferramenta e as fronteiras
do escopo, de modo que as decisões estruturais não fossem tomadas de forma
incremental durante a codificação.

**Implementação realizada**

Definição da aplicação como monólito modular em NestJS, com separação lógica
entre Control Plane, responsável pelos metadados da plataforma, e Data Plane,
responsável pela execução de consultas nos bancos dos usuários. Delimitação do
MVP em consultas `SELECT`, endpoints `GET`, retorno JSON, API Keys e logs.
Registro das regras arquiteturais e do escopo no arquivo `CLAUDE.md`, na raiz do
repositório.

**Decisões técnicas**

- separação de dois contextos de dados, com tecnologias distintas de acesso:
  Prisma para o banco interno da plataforma e `node-postgres` para os bancos
  externos cadastrados pelos usuários;
- runtime dinâmico: a publicação de um endpoint não gera arquivos de código,
  sendo resolvida em tempo de requisição por uma rota genérica;
- restrição do MVP a consultas de leitura;
- exclusão explícita de microserviços, Kubernetes, filas distribuídas e suporte a
  outros SGBDs.

**Funcionamento**

O usuário cadastra uma conexão PostgreSQL, escreve uma consulta `SELECT`, define
parâmetros e publica a consulta como endpoint. O consumo ocorre por uma rota
única no formato `/runtime/{projectSlug}/{version}/{endpointSlug}`, resolvida
dinamicamente a partir dos metadados armazenados no banco interno.

**Validação realizada**

Etapa de definição, sem execução de software. A arquitetura foi validada
posteriormente pela implementação das etapas seguintes, que a seguiram sem
necessidade de revisão estrutural.

**Resultado**

A arquitetura, o escopo do MVP e as restrições do projeto passaram a estar
documentados de forma explícita e versionada, servindo de referência para todas
as etapas subsequentes.

**Problemas encontrados e soluções**

Nenhum problema técnico relevante nesta etapa.

**Possível utilização no TCC**

Metodologia e arquitetura da solução. A separação entre os dois contextos de
dados e a opção pelo runtime dinâmico são justificativas de projeto diretamente
aproveitáveis.

---

### [2026-08-21] — Configuração do monorepo

**Objetivo**

Organizar frontend, backend e eventuais pacotes compartilhados em um único
repositório, com gerenciamento unificado de dependências.

**Implementação realizada**

Criação de um workspace pnpm na raiz, abrangendo `apps/*` e `packages/*`. O
backend foi criado em `apps/api` com NestJS e o frontend em `apps/web` com
Next.js. Foram definidos scripts na raiz para execução e build das duas
aplicações. O diretório `packages/contracts` foi reservado para contratos
compartilhados entre web e API, permanecendo vazio até haver necessidade real.

**Decisões técnicas**

- pnpm como gerenciador de pacotes, com workspace único na raiz e sem lockfiles
  internos por aplicação;
- backend em `module: Node16` / `moduleResolution: Node16` com `strict: true`,
  sem `"type": "module"`, configuração adotada por ser a estável para o conjunto
  NestJS 11 com Prisma 7;
- backend na porta 3001 e frontend na porta 3000, evitando conflito durante o
  desenvolvimento simultâneo;
- prioridade de desenvolvimento no backend, com o frontend mantido no estado de
  scaffold até que os fluxos centrais estejam estáveis.

**Funcionamento**

Cada aplicação é executada por filtro do workspace, sem instalação de
dependências duplicadas entre os projetos.

**Validação realizada**

Executados `pnpm --filter api exec tsc --noEmit` e `pnpm --filter api test`, que
resolveram corretamente o workspace e as dependências do backend.

**Resultado**

O repositório passou a comportar as duas aplicações sob um único gerenciamento de
dependências.

**Problemas encontrados e soluções**

Nenhum problema técnico relevante nesta etapa.

**Possível utilização no TCC**

Metodologia, na descrição do ambiente e da organização do desenvolvimento.

---

### [2026-08-21] — Infraestrutura de bancos PostgreSQL com Docker

**Objetivo**

Disponibilizar dois bancos PostgreSQL isolados para o desenvolvimento: um para os
dados administrativos da plataforma e outro representando um banco externo
cadastrado por um usuário.

**Implementação realizada**

Definição de dois serviços em `docker-compose.yml`, ambos com a imagem
`postgres:17-alpine`, healthcheck por `pg_isready`, volume nomeado para
persistência e credenciais fornecidas por variáveis de ambiente. O container
`gerador-api-platform-db` hospeda o banco `gerador_api_platform` e o container
`gerador-api-demo-db` hospeda o banco `gerador_api_demo`.

**Decisões técnicas**

- exposição do banco da plataforma na porta 5434 do host e do banco demo na 5433,
  ambos mapeados para 5432 internamente, porque a porta 5432 do host está ocupada
  por uma instalação nativa de PostgreSQL no Windows;
- separação entre os dois bancos desde o início do desenvolvimento, de modo que o
  banco demo seja tratado exclusivamente como banco externo, acessado por `pg` e
  nunca por Prisma;
- credenciais fornecidas por variáveis de ambiente, com o arquivo `.env` fora do
  controle de versão e um `.env.example` documentando os nomes esperados.

**Funcionamento**

Os dois containers sobem pelo Docker Compose com persistência em volumes
nomeados. A aplicação conecta ao banco da plataforma por `127.0.0.1:5434`. O
banco demo serve como cenário de teste para conexões externas, introspecção,
consultas salvas e demonstração do trabalho.

**Validação realizada**

A geração da migration inicial pela CLI do Prisma, descrita na etapa seguinte,
pressupõe conexão efetiva com o banco da plataforma, o que confirma o
funcionamento do container `gerador-api-platform-db`. A verificação do estado de
execução dos containers não foi refeita na revisão de 2026-08-21, por
indisponibilidade do CLI do Docker no ambiente de auditoria. O banco demo ainda
não possui estrutura de dados; sua modelagem está prevista para a etapa M3.

**Resultado**

O ambiente de desenvolvimento passou a contar com dois bancos PostgreSQL
isolados, refletindo a separação arquitetural entre dados da plataforma e dados
de usuário.

**Problemas encontrados e soluções**

*Problema.* Conflito de porta com a instalação nativa de PostgreSQL no Windows,
que já ocupava a 5432 no host.
*Causa.* Mapeamento inicial dos containers para a porta padrão do PostgreSQL.
*Solução.* Realocação para as portas 5433 e 5434 no host, preservando 5432 dentro
dos containers. A decisão foi registrada para impedir reversão futura.

**Possível utilização no TCC**

Metodologia e descrição do ambiente de desenvolvimento e de testes.

---

### [2026-08-21] — Modelagem do banco interno e migration inicial

**Objetivo**

Modelar as entidades administrativas da plataforma e versionar o schema do banco
interno.

**Implementação realizada**

Definição de oito entidades em `prisma/schema.prisma` — `User`, `Project`,
`DatabaseConnection`, `SavedQuery`, `QueryParameter`, `Endpoint`, `ApiKey` e
`RequestLog` — além dos enums `DatabaseSslMode` e `QueryParameterType`. Criação
da migration inicial `20260821183942_init_platform_schema` e configuração do
`PrismaService` como serviço NestJS, estendendo o `PrismaClient` sobre o driver
adapter `@prisma/adapter-pg`.

**Decisões técnicas**

- Prisma utilizado exclusivamente no banco interno, cujo schema é conhecido em
  tempo de desenvolvimento;
- URL de conexão mantida fora do `schema.prisma`: o datasource declara apenas o
  provider e a URL é resolvida em `prisma.config.ts` a partir de `DATABASE_URL`;
- client gerado em `src/generated/prisma` com `moduleFormat = "cjs"`, coerente com
  a configuração CommonJS do backend, e mantido fora do controle de versão;
- `Endpoint` referencia `SavedQuery` em vez de duplicar o SQL, e não possui campo
  `method`, já que toda publicação do MVP é `GET`;
- políticas de exclusão diferenciadas: `Cascade` para dependências indissociáveis,
  `Restrict` para origens referenciadas por artefatos publicados — impedindo que
  uma conexão ou consulta usada por endpoints seja removida — e `SetNull` em
  `RequestLog.apiKeyId`, preservando o histórico após a revogação de uma chave;
- `QueryParameter` com restrições de unicidade sobre nome e posição dentro da
  mesma consulta, garantindo a montagem determinística do array de valores;
- `Endpoint` com unicidade sobre a combinação de projeto, versão e slug,
  assegurando que cada URL de runtime resolva um único endpoint;
- `ApiKey` prevista desde a modelagem com `keyHash`, `keyPrefix`, `expiresAt`,
  `revokedAt` e `lastUsedAt`, sem campo para o token completo.

**Funcionamento**

O `PrismaService` cria um pool `pg` a partir de `DATABASE_URL`, conecta na
inicialização do módulo e, no encerramento da aplicação, desconecta o client e
finaliza o pool. O desligamento é acionado por `enableShutdownHooks()` em
`main.ts`.

**Validação realizada**

A migration foi gerada e aplicada pela CLI do Prisma sobre o banco da plataforma.
O client gerado está presente e o backend compila contra ele, conforme verificado
por `tsc --noEmit`. A rota `GET /health/database` executa uma consulta simples
pelo Prisma, mas sua execução não foi realizada nesta revisão.

**Resultado**

O banco interno da plataforma passou a ter schema versionado, cobrindo todas as
entidades necessárias ao MVP, com o acesso encapsulado em um serviço NestJS de
ciclo de vida controlado.

**Problemas encontrados e soluções**

Nenhum problema técnico relevante nesta etapa.

**Possível utilização no TCC**

Arquitetura da solução e implementação. O modelo de dados e a justificativa das
políticas de exclusão são diretamente aproveitáveis, assim como a decisão de
restringir o Prisma ao banco interno.

---

### [2026-08-21] — HealthModule

**Objetivo**

Disponibilizar verificação de disponibilidade da aplicação e da conexão com o
banco interno.

**Implementação realizada**

Módulo com duas rotas: `GET /health`, que responde o estado do serviço sem tocar
o banco, e `GET /health/database`, que executa `SELECT 1` pelo Prisma para
confirmar a conectividade.

**Decisões técnicas**

Separação entre a verificação do processo e a verificação da dependência externa,
permitindo distinguir uma aplicação no ar de uma aplicação sem acesso ao banco.

**Funcionamento**

A rota de banco executa uma consulta mínima e retorna estado de conexão; falhas
resultam em erro da requisição.

**Validação realizada**

Rotas presentes no código e compiladas com sucesso. A execução das rotas contra a
aplicação em funcionamento não foi realizada nesta revisão.

**Resultado**

A aplicação passou a expor verificação de disponibilidade própria e do banco
interno.

**Problemas encontrados e soluções**

Nenhum problema técnico relevante nesta etapa.

**Possível utilização no TCC**

Implementação, em observabilidade básica da aplicação.

---

### [2026-08-21] — ProjectsModule

**Objetivo**

Implementar a primeira funcionalidade de negócio da plataforma: o cadastro de
projetos, que agrupa conexões, endpoints e API Keys.

**Implementação realizada**

Módulo com serviço e controller cobrindo criação, listagem, consulta individual,
atualização e remoção de projetos. Criação e listagem retornam campos
selecionados explicitamente. A consulta individual agrega a contagem de conexões,
endpoints e API Keys vinculados. A listagem aceita filtro opcional por
proprietário. Configuração de `ValidationPipe` global em `main.ts` com
`whitelist`, `forbidNonWhitelisted` e `transform`.

**Decisões técnicas**

- normalização do slug no servidor, com remoção de acentos, conversão para
  minúsculas e substituição de sequências não alfanuméricas por hífen, derivando
  o slug do nome quando não informado — o slug compõe a URL pública dos
  endpoints, e normalizar no servidor garante URLs válidas independentemente do
  cliente;
- verificação de disponibilidade do slug antes da gravação, com retorno de
  conflito, complementando o índice único do banco com uma mensagem de erro
  adequada;
- validação da existência do proprietário antes da criação do projeto;
- recebimento temporário de `ownerId` pelo DTO, por ainda não existir
  autenticação, com a substituição prevista para a etapa M9;
- uso de exceções do NestJS em vez de erros genéricos, resultando em respostas
  HTTP semanticamente corretas.

**Funcionamento**

O cliente envia nome e proprietário; o slug é gerado ou normalizado, verificado
quanto à unicidade e persistido. A remoção de um projeto propaga em cascata para
conexões, endpoints e API Keys vinculados, conforme definido no schema.

**Validação realizada**

Conforme registrado no `CLAUDE.md`, as cinco rotas foram exercitadas manualmente
durante o desenvolvimento, incluindo a normalização de slug, que converte
`Farmácia Demo` em `farmacia-demo`. Não existem testes automatizados para este
módulo; a única suíte automatizada do projeto até esta data cobre o controller
remanescente do scaffold do NestJS.

**Resultado**

A aplicação passou a permitir a administração de projetos, estabelecendo o
agrupador ao qual as demais entidades da plataforma se vinculam.

**Problemas encontrados e soluções**

Nenhum problema técnico relevante nesta etapa.

**Possível utilização no TCC**

Implementação. A normalização de slug no servidor é relevante para a discussão da
composição das URLs dos endpoints publicados.

---

### [2026-08-21] — CryptoService

**Objetivo**

Prover criptografia de credenciais de bancos externos, requisito prévio ao
cadastro de conexões, de modo que nenhuma senha de banco de usuário seja
persistida em texto puro.

**Implementação realizada**

Serviço de criptografia simétrica com AES-256-GCM, exposto por um módulo
declarado `@Global` e registrado no módulo raiz da aplicação. A chave é obtida de
`CONNECTION_ENCRYPTION_KEY`, interpretada como hexadecimal, com verificação de
comprimento de 32 bytes na construção do serviço. A operação de cifragem gera um
IV aleatório de 12 bytes e devolve IV, authentication tag e ciphertext
concatenados em hexadecimal. A operação inversa valida a presença dos três
componentes antes de tentar decifrar.

**Decisões técnicas**

- uso de criptografia reversível em vez de hashing, porque a aplicação precisa
  recuperar a senha em texto puro no momento de abrir a conexão com o banco
  externo;
- escolha de um modo autenticado, AES-256-GCM: o authentication tag permite
  detectar adulteração do ciphertext, o que um modo apenas confidencial não
  faria;
- geração de IV aleatório por operação, evitando que valores iguais produzam
  ciphertexts idênticos;
- armazenamento, junto ao ciphertext, de todos os elementos necessários à
  decifragem exceto a chave, que permanece exclusivamente na configuração da
  aplicação e nunca é gravada no banco;
- falha na inicialização quando a chave está ausente ou tem comprimento
  incorreto, impedindo que a aplicação suba em estado capaz de gravar
  credenciais de forma inadequada.

**Funcionamento**

A senha recebida pela API é cifrada antes da persistência e gravada no campo
`passwordEncrypted`. No momento de conectar ao banco externo, o valor é decifrado
em memória. O campo cifrado não deve ser retornado por nenhuma rota.

**Validação realizada**

Apenas verificação de compilação, por `tsc --noEmit`. Não existem testes
automatizados para o serviço até esta data, nem uso efetivo em fluxo de negócio,
já que o cadastro de conexões ainda não foi implementado. Os testes do
`CryptoService` permanecem pendentes e estão previstos para a etapa M1.

**Resultado**

A aplicação passou a dispor da primitiva de criptografia necessária ao
armazenamento seguro de credenciais de bancos externos. A funcionalidade que a
consome ainda não existe.

**Problemas encontrados e soluções**

Nenhum problema técnico relevante nesta etapa.

**Possível utilização no TCC**

Segurança e implementação. A justificativa para criptografia reversível em vez de
hashing, e para a escolha de um modo autenticado, é diretamente aproveitável na
discussão do tratamento de credenciais.
