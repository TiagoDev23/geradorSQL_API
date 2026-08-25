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

---

### [2026-08-21] — M1: Database Connections

**Objetivo**

Permitir que um projeto cadastre conexões com bancos PostgreSQL externos, teste
essas conexões e o faça sem armazenar credenciais em texto puro.

**Implementação realizada**

Módulo de conexões com CRUD completo e verificação de conectividade, exposto em
seis rotas. As operações de criação e listagem são subordinadas ao projeto; as
demais operam sobre o identificador da conexão. A senha recebida é cifrada pelo
`CryptoService` antes de persistir e nunca é devolvida. Foram criados também os
testes do `CryptoService`, pendentes desde a etapa anterior.

**Decisões técnicas**

- lista explícita de campos públicos no service, com `passwordEncrypted` omitido
  por construção, em vez de remoção do campo após a consulta — a credencial
  cifrada nunca chega a ser carregada nas rotas de leitura;
- bancos externos acessados exclusivamente por `pg`, com `Client` de vida curta:
  timeout de 5 s para conexão e para consultas, e encerramento em bloco `finally`
  para não deixar recursos abertos mesmo em caso de falha;
- erros do PostgreSQL retidos no log da aplicação; o cliente recebe apenas uma
  mensagem genérica com status 503, evitando que detalhes do servidor externo
  sejam expostos;
- verificação prévia da existência de consultas salvas antes de remover uma
  conexão, devolvendo conflito com mensagem clara em vez de um erro de
  integridade referencial vindo do banco;
- na atualização, a credencial só é substituída quando a senha é informada,
  permitindo editar host, porta ou nome sem reenviar a senha.

**Funcionamento**

Usuário cadastra a conexão → senha é cifrada e persistida → ao solicitar o teste,
a credencial é decifrada em memória, um cliente temporário conecta ao banco
externo, executa `SELECT current_database(), current_user, version()`, e o
cliente é encerrado → a resposta traz banco, usuário, versão do servidor e
duração da verificação.

**Validação realizada**

Build, `tsc --noEmit` e ESLint sem erros. Suíte automatizada com 28 testes em 3
arquivos: 15 para o `CryptoService` (formato do valor cifrado, unicidade do IV,
rejeição de chave inválida, de valor adulterado e de valor cifrado com outra
chave) e 13 para o service de conexões (cifragem antes da persistência, ausência
de `passwordEncrypted` nas projeções, preservação da credencial na atualização e
regras de conflito).

Verificação funcional das seis rotas contra PostgreSQL 17.11 em container. O
teste de conectividade bem-sucedido retornou banco, usuário e versão em 11 ms.
Confirmou-se no banco interno que as credenciais estão gravadas em três
componentes hexadecimais e que a senha em texto puro não aparece em nenhum
registro. Os casos de erro responderam conforme esperado: 409 para nome
duplicado, 404 para projeto ou conexão inexistente, 400 para UUID inválido,
porta fora de faixa e tentativa de enviar `passwordEncrypted` no corpo, e 503
para falha de autenticação no banco externo.

**Resultado**

A aplicação passou a permitir o cadastro e a verificação de conexões PostgreSQL
externas sem persistir credenciais em texto puro e sem expor detalhes técnicos
do servidor de destino.

**Problemas encontrados e soluções**

*Problema.* O `CryptoService` rejeitava a própria saída ao decifrar um valor
originalmente vazio.
*Causa.* A validação exigia ciphertext não vazio, condição que o modo GCM não
garante quando o texto de origem é vazio.
*Solução.* A verificação passou a exigir a presença dos três componentes e o
preenchimento apenas do IV e do authentication tag. O defeito foi encontrado
pelos testes, antes de qualquer uso em produção.

*Problema.* O teste de conexão contra o banco demo falhou com `28P01`.
*Causa.* A senha registrada em `.env` não corresponde à que o container recebeu
na inicialização do volume; a imagem do PostgreSQL aplica `POSTGRES_PASSWORD`
apenas na primeira execução. Não se trata de defeito da aplicação.
*Solução.* A verificação funcional bem-sucedida foi feita contra o container da
plataforma, na porta 5434, que do ponto de vista do código é apenas mais um
PostgreSQL externo. A divergência do banco demo permanece em aberto e precisa ser
resolvida antes da etapa M3.

*Problema.* O Jest não resolvia os imports com extensão `.js` do client gerado
pelo Prisma, resolvidos pelo compilador mas não pelo resolvedor de testes.
*Solução.* Mapeamento desses especificadores na configuração do Jest, sem
alteração de código de aplicação nem de dependências.

**Possível utilização no TCC**

Implementação e segurança. O tratamento de credenciais, o isolamento dos erros do
banco externo e o ciclo de vida curto das conexões são aproveitáveis na
discussão de segurança; a medição de duração do teste inaugura a coleta de
métricas que será ampliada nas etapas de runtime e desempenho.

---

### [2026-08-21] — M2: Introspecção PostgreSQL

**Objetivo**

Permitir que a plataforma consulte a estrutura de um banco externo já
cadastrado, para que o usuário possa escrever consultas conhecendo schemas,
tabelas, colunas e relacionamentos disponíveis.

**Implementação realizada**

Módulo de introspecção com três rotas: listagem de schemas, listagem de tabelas
e views com filtro opcional por schema, e detalhamento de uma tabela com
colunas, tipos, nulidade, valores padrão, chave primária e chaves estrangeiras.

O acesso a bancos externos, antes contido no módulo de conexões, foi extraído
para um serviço próprio compartilhado pelos dois módulos. O teste de conexão do
M1 passou a usá-lo, sem alteração de comportamento.

**Decisões técnicas**

- introspecção sob demanda, sem espelhar a estrutura do banco do usuário no
  banco interno, evitando o problema de manter em sincronia uma cópia de algo
  que muda fora da governança da plataforma;
- consultas sobre `pg_catalog` em vez de `information_schema`: o padrão não
  expõe de forma confiável a ordem das colunas em chaves compostas nem o tipo
  formatado da coluna. `generate_subscripts` percorre `conkey` e `confkey`
  preservando essa ordem, de modo que chaves compostas sejam reconstruídas
  corretamente;
- schema e tabela sempre enviados como parâmetros posicionais, nunca
  concatenados ao SQL, mesmo vindo de segmentos de URL;
- extração do acesso externo para serviço único, concentrando decifragem da
  credencial, timeouts, encerramento do cliente e conversão de erros. Erros de
  domínio da operação, como tabela inexistente, são preservados; os demais são
  convertidos em resposta genérica;
- distinção entre falha de conexão e falha de consulta, com mensagens
  correspondentes, sem expor detalhe técnico ao cliente;
- ausência de filtro por schema devolve todos os schemas visíveis: aplicar o
  `defaultSchema` da conexão automaticamente esconderia estruturas que o
  usuário pode querer consultar.

**Funcionamento**

Requisição informa a conexão → credencial é decifrada → cliente temporário
conecta ao banco externo → consulta ao catálogo do PostgreSQL → resultado é
convertido em estrutura JSON própria → cliente é encerrado.

**Validação realizada**

Build, `tsc --noEmit` e ESLint sem erros nos arquivos dos módulos. Suíte
automatizada ampliada de 28 para 36 testes em 4 arquivos; os 8 novos cobrem a
exclusão de schemas internos, a parametrização posicional, a marcação das
colunas que compõem a chave primária, a ausência de chave primária e o
agrupamento de chave estrangeira composta em uma única relação.

Verificação funcional contra o banco interno da plataforma, usado como banco
externo por possuir estrutura real: 1 schema e 9 tabelas listados corretamente.
O detalhamento de `RequestLog` devolveu as 8 colunas com tipos formatados
(incluindo `timestamp(3) without time zone`), nulidade correta, valor padrão
`CURRENT_TIMESTAMP`, a chave primária marcada na coluna correspondente e as duas
chaves estrangeiras resolvidas para `ApiKey` e `Endpoint`. Filtro por schema
inexistente devolveu lista vazia; tabela inexistente, 404; conexão inexistente,
404; identificador fora do formato UUID, 400.

Tentativa de injeção pelo segmento de URL da tabela foi tratada como nome
literal, resultando em 404, e a integridade das tabelas do banco foi conferida
em seguida. O teste de conexão do M1 foi reexecutado após a refatoração e
manteve o comportamento anterior.

**Resultado**

A plataforma passou a expor a estrutura de bancos PostgreSQL cadastrados,
incluindo relacionamentos, sem armazenar essa estrutura e sem expor o catálogo
diretamente ao cliente.

**Problemas encontrados e soluções**

*Problema.* O tratamento de erro centralizado converteria também as exceções de
domínio lançadas pela operação, transformando "tabela não encontrada" em erro
genérico de consulta.
*Solução.* O serviço compartilhado repassa exceções HTTP sem alteração e
converte apenas as demais.

**Possível utilização no TCC**

Implementação e arquitetura da solução. A justificativa para introspecção sob
demanda e para o uso de `pg_catalog` em lugar de `information_schema` é
aproveitável na discussão do acesso a bancos heterogêneos; a extração do serviço
compartilhado ilustra a separação entre Control Plane e Data Plane.

---

### [2026-08-21] — M3: Base de dados meteorológica

**Objetivo**

Criar o banco PostgreSQL externo de demonstração, com estrutura rica o
suficiente para validar a introspecção do M2 e volume capaz de crescer para os
testes de desempenho.

**Implementação realizada**

Estrutura em três schemas — `referencia`, `meteorologia` e `impactos` — com 9
tabelas, 2 views, 9 chaves estrangeiras, 8 constraints UNIQUE e 24 CHECKs.
Scripts SQL próprios em `infra/demo-database/`, idempotentes e sem `DROP`,
acompanhados de um gerador parametrizável de observações.

**Decisões técnicas**

- domínio meteorológico escolhido porque séries temporais crescem por
  construção: o volume é função de estações × frequência × tempo, e aumentar a
  carga não exige redesenhar o banco;
- três schemas em vez de `public`, para exercitar a introspecção em ambiente
  multi-schema; sete das nove chaves estrangeiras atravessam schemas;
- `meteorologia.resumos_diarios` com chave primária composta `(estacao_id,
  data)`, sem coluna sintética, por a identidade da linha ser efetivamente esse
  par;
- ausência de índice sobre `(estacao_id, observado_em)`: o UNIQUE já produz o
  índice equivalente, e duplicá-lo encareceria a inserção na tabela de maior
  volume;
- dados sintéticos e determinísticos, declarados como tais na documentação, sem
  vínculo com qualquer serviço meteorológico;
- Prisma não é usado neste banco, conforme a separação entre banco interno e
  bancos externos.

**Funcionamento**

Os scripts são aplicados na ordem numérica pelo container do PostgreSQL demo. A
carga inicial cobre sete dias de medições horárias para cada estação. Volumes
maiores são obtidos pelo gerador, que amplia apenas a tabela de observações.

**Validação realizada**

Scripts executados contra o container `gerador-api-demo-db`. Carga resultante:
27 estados, 81 municípios, 90 estações, 6 tipos de evento, 15.120 observações,
720 resumos diários, 405 previsões, 81 eventos climáticos e 121 impactos,
ocupando cerca de 2,9 MB na tabela de observações com seus índices.
Idempotência confirmada por reexecução, sem duplicação.

As consultas de catálogo do M2 foram executadas diretamente sobre a base e
retornaram corretamente: os três schemas de domínio, as 9 tabelas e as 2 views
distinguidas por tipo, a chave primária composta com as colunas na ordem certa,
a chave estrangeira de `meteorologia.observacoes` para `referencia.estacoes` e
as duas chaves estrangeiras de `impactos.impactos_climaticos`, uma delas
apontando para `meteorologia`. Tipos formatados, nulidade e valores padrão
também foram conferidos.

A validação pela API HTTP do M2 **não foi executada**: a senha do banco demo
registrada em `.env` não corresponde à que o container recebeu na inicialização
do volume, impedindo o cadastro de uma conexão funcional. A pendência é de
ambiente, não de código, e permanece aberta.

Nenhum código do backend foi alterado nesta etapa, portanto build e testes não
foram reexecutados.

**Resultado**

A plataforma passou a dispor de um banco externo real, com múltiplos schemas e
relacionamentos entre eles, servindo de cenário para as próximas milestones e
para os testes de volume.

**Problemas encontrados e soluções**

*Problema.* A primeira execução do seed falhou por incompatibilidade de tipos
(`date + bigint`) e, ao ser revertida, deixou as sequences avançadas. A carga
seguinte, que derivava valores de identificadores absolutos, produziu junções
vazias.
*Solução.* Correção do cast e substituição da lógica dependente de
identificadores por ordenação relativa, tornando o seed independente do estado
das sequences.

**Possível utilização no TCC**

Metodologia e resultados. A base descreve o ambiente experimental, e a
justificativa do domínio sustenta a discussão sobre disponibilização de grandes
volumes. Documentação completa em `docs/METEOROLOGY_DATABASE.md`.

---

### [2026-08-21] — M3: encerramento e volume inicial definitivo

**Objetivo**

Fixar o volume da carga inicial do banco demo, encerrando o M3.

**Estrutura criada**

Sem alteração estrutural em relação à entrada anterior: três schemas, 9
tabelas, 2 views, 9 chaves estrangeiras e chave primária composta em
`meteorologia.resumos_diarios`.

**Volume inicial**

A janela de observações do seed passou de 7 para 20 dias, elevando a carga
padrão de 15.120 para **43.200 observações** — 90 estações × 20 dias × 24
horas, uma medição por hora. Os resumos diários, recalculados a partir dessa
janela, passaram de 720 para 1.890 registros. As demais tabelas permaneceram
inalteradas: 27 estados, 81 municípios, 90 estações, 6 tipos de evento, 405
previsões, 81 eventos climáticos e 121 impactos.

A agregação diária passou a usar `ON CONFLICT DO UPDATE`: com `DO NOTHING`, os
resumos de dias já existentes não seriam recalculados ao ampliar a janela, e
ficariam inconsistentes com as observações.

**Validação realizada**

Seed reexecutado sobre a base existente. Conferido que as observações somam
exatamente 43.200, distribuídas em 480 instantes distintos, com todas as 90
estações apresentando exatamente 480 registros. Idempotência confirmada por
nova reexecução, sem variação nas contagens. A tabela de observações ocupa
cerca de 8,4 MB com os índices.

A introspecção do M2 sobre esta base foi validada manualmente e confirmada:
schemas, tabelas, views, colunas e tipos, chave primária simples e composta,
chaves estrangeiras e relacionamentos entre schemas.

O gerador de grandes volumes permanece separado do seed, com padrão pequeno e
volumes maiores exigindo parâmetro explícito. Nenhuma carga acima do volume de
desenvolvimento foi executada.

**Resultado**

M3 encerrado. O banco demo passou a ter volume inicial definitivo de 43.200
observações sintéticas e reproduzíveis, servindo de base para as Saved Queries
do M4 e para os testes de desempenho previstos.

---

### [2026-08-21] — M4: Consultas salvas

**Objetivo**

Permitir que o usuário grave consultas SQL vinculadas a uma conexão, declare
seus parâmetros e execute a consulta de teste com resultado em JSON.

**Implementação realizada**

Módulo de consultas salvas com CRUD e execução, exposto em seis rotas. Os
parâmetros são tratados como coleção subordinada à consulta: acompanham a
criação e são substituídos integralmente na atualização, sem módulo próprio.
Foram criadas duas peças independentes do NestJS: uma camada de validação de
SQL e um conversor de parâmetros.

**Decisões técnicas**

- a validação de SQL não inspeciona o início da string, que é contornável. O
  texto passa por uma normalização que substitui comentários, literais,
  blocos com dollar quoting e identificadores entre aspas por espaços; apenas
  o resíduo é analisado. Assim, uma palavra proibida dentro de um comentário
  não bloqueia indevidamente, e um comando escondido após um comentário não
  escapa da análise;
- além dos comandos de escrita e DDL, são bloqueados controle de transação,
  manipulação de sessão, `SELECT ... INTO` e funções que alcançam o sistema de
  arquivos ou prendem a conexão, como `pg_read_file` e `pg_sleep`;
- múltiplas instruções são recusadas, aceitando-se apenas um ponto e vírgula
  final;
- a conversão de parâmetros é estrita: valor incompatível com o tipo declarado
  gera erro, nunca coerção silenciosa. Aceitar "abc" como zero produziria um
  resultado plausível e errado;
- o SQL e os parâmetros são validados como par: cada marcador `$n` precisa de
  um parâmetro na posição correspondente, e vice-versa, o que impede gravar
  uma consulta impossível de executar;
- o limite de linhas é aplicado envolvendo a consulta original em uma
  subconsulta, sem reescrevê-la, com valor inteiro controlado pela aplicação;
- o SQL é revalidado no momento da execução, e não apenas ao ser gravado,
  porque as regras de validação podem mudar depois da gravação;
- o acesso ao banco externo reutiliza o serviço compartilhado criado no M2,
  mantendo decifragem da credencial, timeouts e encerramento do cliente em um
  único lugar.

**Funcionamento**

Usuário escolhe a conexão → grava a consulta com marcadores posicionais e
declara os parâmetros → ao executar, os valores recebidos são convertidos para
os tipos declarados, ordenados por posição e enviados ao driver separados do
texto da consulta → o resultado volta com colunas, linhas, contagem e duração.

**Validação realizada**

Build, `tsc --noEmit` e ESLint sem erros. Suíte automatizada ampliada de 36
para 144 testes em 8 arquivos, cobrindo a validação de SQL, a conversão de
cada tipo de parâmetro, o CRUD, a execução e o encerramento do cliente em
sucesso, em falha de consulta e em falha de conexão.

Verificação funcional contra o banco meteorológico do M3, com quatro consultas
de demonstração: sem parâmetros, por estação, por estação e período, e
agregada por estação. A consulta por período devolveu 24 registros horários em
22 ms; a agregada devolveu médias por estação em 19 ms. Os casos de erro
responderam conforme esperado: comando de escrita e múltiplas instruções
recusados na gravação, parâmetro obrigatório ausente e tipo inválido recusados
antes de abrir conexão, e 404 para consulta ou conexão inexistente.

**Resultado**

A plataforma passou a permitir gravar e executar consultas parametrizadas sobre
bancos externos, restritas a leitura, com os valores sempre separados do texto
SQL. É a última peça antes da publicação de endpoints.

**Uso no TCC**

Implementação e segurança. A camada de validação de SQL e a conversão estrita
de parâmetros sustentam a discussão sobre execução controlada de consultas
fornecidas pelo usuário; as medições de duração inauguram a comparação de
desempenho entre consultas simples e agregadas.

---

### [2026-08-21] — M5: Gerenciamento de endpoints

**Objetivo**

Permitir configurar e publicar consultas salvas como endpoints, preparando a
rota que o runtime do M6 resolverá.

**Implementação realizada**

Módulo de endpoints com CRUD e controle de publicação, em sete rotas. O
endpoint referencia a consulta e não guarda cópia do SQL. As respostas trazem
a rota futura derivada de projeto, versão e slug, além de um resumo da consulta
com seus parâmetros.

**Decisões técnicas**

- nenhuma alteração de schema: o modelo `Endpoint` já previa slug, versão,
  `isPublished`, `publishedAt`, `maxRows` e a unicidade da rota;
- formato de versão definido como `v` seguido de inteiro, registrado em D16;
- slug informado precisa já estar normalizado; quando omitido, é derivado do
  nome. Validar em vez de normalizar silenciosamente evita que o usuário
  receba uma URL diferente da que pediu;
- a consulta precisa pertencer ao mesmo projeto do endpoint, vínculo verificado
  indiretamente por `SavedQuery → DatabaseConnection → Project`;
- o SQL da consulta é revalidado na criação e na publicação, antes de expor a
  rota;
- remover endpoint publicado é recusado: além de derrubar uma rota em uso, a
  cascata definida no schema apagaria o histórico de requisições. Despublicar
  primeiro torna a intenção explícita.

**Validação realizada**

Build, `tsc --noEmit` e ESLint sem erros. Suíte ampliada de 144 para 198 testes
em 10 arquivos. Verificação funcional com três endpoints de demonstração sobre
as consultas do M4, um deles publicado. Conferido no banco interno que a tabela
`Endpoint` não possui coluna de SQL e que o vínculo é por `savedQueryId`.
Confirmado que a rota `/runtime/...` ainda responde 404, por não existir neste
milestone. Casos de erro conferidos: slug e versão inválidos, rota duplicada,
mesmo slug em outra versão aceito, consulta de outro projeto, campo `method`
recusado e remoção de endpoint publicado.

**Resultado**

A plataforma passou a configurar e publicar endpoints. Falta apenas o runtime
que resolve a rota e executa a consulta, previsto para o M6.

**Uso no TCC**

Implementação. A separação entre configuração e execução, com o endpoint como
dado e não como código, sustenta a discussão sobre o runtime dinâmico.

---

### [2026-08-21] — M6: Runtime dinâmico

**Objetivo**

Transformar os endpoints configurados no M5 em rotas REST executáveis, sem
gerar código específico para cada um.

**Implementação realizada**

Uma única rota, `GET /runtime/:projectSlug/:version/:endpointSlug`, resolve
qualquer endpoint publicado em tempo de requisição. A execução da consulta do
M4 foi extraída para uma função compartilhada, usada tanto pela execução de
teste quanto pelo runtime.

**Decisões técnicas**

- extração do executor em vez de duplicação: as duas formas de execução
  precisam das mesmas garantias — somente leitura, parametrização, timeout,
  encerramento da conexão — e duplicá-las abriria espaço para divergirem;
- resolução em uma única consulta ao banco interno, trazendo endpoint,
  consulta, parâmetros e conexão pelas relações;
- projeto inexistente, versão errada, endpoint inexistente e endpoint não
  publicado produzem a mesma resposta 404: distinguir os casos revelaria a
  existência de rotas ainda não publicadas;
- parâmetros vêm da query string e são convertidos antes de conectar, de modo
  que entrada inválida não custe uma conexão ao banco do usuário;
- o limite aplicado é o `maxRows` do endpoint, e não o limite da execução de
  teste;
- o serviço não contém SQL nem qualquer conhecimento do domínio publicado; um
  teste verifica isso lendo o próprio código-fonte.

**Validação realizada**

Build, `tsc --noEmit` e ESLint sem erros. Suíte ampliada de 198 para 216
testes em 11 arquivos, cobrindo resolução da rota, ordem posicional dos
parâmetros, conversão de tipos, endpoint não publicado, encerramento da
conexão em sucesso e em erro, e ausência de SQL específico no runtime.

Verificação funcional contra o banco meteorológico: endpoint sem parâmetros
(5 registros, 27 ms), com um parâmetro (480 registros, 59 ms) e com três
parâmetros de período (24 registros, 28 ms). Registrou-se também o cenário
central do trabalho: uma consulta e um endpoint foram cadastrados durante a
execução da aplicação, a rota respondeu 404 antes da publicação e devolveu
dados imediatamente após, sem reinício nem geração de arquivo.

**Resultado**

O fluxo do MVP passou a funcionar de ponta a ponta, da conexão ao consumo do
endpoint. Faltam API Keys, logs e autenticação.

**Uso no TCC**

Resultados e arquitetura da solução. A resolução dinâmica sem geração de
código é a característica central do trabalho, e a demonstração de cadastro e
consumo sem reinício serve diretamente à avaliação.
