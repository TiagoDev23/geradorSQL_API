# DECISIONS — Registro de decisões técnicas

Decisões já tomadas e presentes no repositório, com a justificativa
correspondente. Cada registro descreve o que foi decidido, por quê e qual
consequência prática impõe ao desenvolvimento.

Este documento registra decisões vigentes. Alterações futuras devem ser
acrescentadas como novo registro, preservando o anterior.

---

## D1 — Monólito modular em vez de microserviços

**Decisão.** A aplicação é um único processo NestJS, organizado em módulos, com
separação lógica entre Control Plane e Data Plane.

**Justificativa.** O trabalho é conduzido por um único desenvolvedor e o escopo é
bem delimitado. Microserviços acrescentariam custo de operação, comunicação e
observabilidade sem benefício correspondente para o problema tratado.

**Consequência.** A separação de responsabilidades é obtida por módulos e
serviços, não por fronteiras de rede.

---

## D2 — Prisma restrito ao banco interno

**Decisão.** O Prisma é usado exclusivamente no banco da plataforma. Bancos
externos são acessados apenas por `node-postgres` (`pg`).

**Justificativa.** O Prisma pressupõe schema conhecido em tempo de
desenvolvimento e geração estática de client. Os bancos dos usuários têm schema
arbitrário, descoberto em tempo de execução, e não estão sob governança da
aplicação. Gerar Prisma Client dinamicamente seria custoso e frágil.

**Consequência.** Não existe schema Prisma nem migration para banco de usuário, e
a aplicação nunca executa migration em banco externo. Introspecção e execução de
consultas usam SQL direto sobre `information_schema` e `pg_catalog`.

---

## D3 — URL do banco fora do schema.prisma

**Decisão.** O bloco `datasource` declara apenas o provider. A URL é resolvida em
`prisma.config.ts`, a partir de `DATABASE_URL`.

**Justificativa.** Formato adotado pelo Prisma 7 e usado para manter credenciais
fora de arquivos de schema versionados.

**Consequência.** `prisma.config.ts` importa `dotenv/config`, e os comandos da
CLI dependem de `DATABASE_URL` estar disponível no ambiente.

---

## D4 — CommonJS com Node16, sem conversão para ESM

**Decisão.** O backend permanece em `module: Node16` / `moduleResolution: Node16`,
sem `"type": "module"` e sem extensões `.js` nos imports. O Prisma Client é
gerado com `moduleFormat = "cjs"`.

**Justificativa.** Essa configuração é a que se mostrou estável para o conjunto
NestJS 11 + Prisma 7 utilizado. Uma migração para ESM traria risco sem ganho
funcional para o projeto.

**Consequência.** Conversão para ESM não deve ser feita sem necessidade real e
justificada.

---

## D5 — AES-256-GCM para credenciais de bancos externos

**Decisão.** Senhas de conexões externas são cifradas com AES-256-GCM antes de
persistir. A chave, de 32 bytes, vem de `CONNECTION_ENCRYPTION_KEY`.

**Justificativa.** A aplicação precisa recuperar a senha em texto puro no momento
de abrir a conexão, o que exclui hashing. Sendo necessária criptografia
reversível, optou-se por um modo autenticado: o authentication tag permite
detectar adulteração do ciphertext, o que um modo apenas confidencial não faria.

**Consequência.** O valor armazenado concatena IV, authentication tag e
ciphertext em hexadecimal, separados por dois-pontos. Um IV aleatório de 12 bytes
é gerado a cada operação. A chave nunca é gravada no banco, e
`passwordEncrypted` nunca é exposto por API.

---

## D6 — API Keys armazenadas apenas como hash

**Decisão.** O token completo é exibido uma única vez, no momento da criação. O
banco guarda `keyHash` e `keyPrefix`.

**Justificativa.** A chave é um segredo de portador: quem a possui consome os
endpoints. Armazenar apenas o hash limita o impacto de um vazamento do banco
interno. O prefixo permite que o usuário identifique visualmente qual chave é
qual, sem que o valor completo precise ser retido.

**Consequência.** Uma chave perdida não pode ser recuperada, apenas revogada e
substituída.

---

## D7 — Runtime dinâmico em vez de geração de código

**Decisão.** Publicar um endpoint não gera arquivos de controller. Uma rota
genérica resolve projeto, versão e endpoint em tempo de requisição.

**Justificativa.** Geração de código exigiria escrita em disco e recompilação ou
reinício a cada publicação, tornando a plataforma dependente do ciclo de build
para uma operação que deve ser imediata. A resolução dinâmica mantém a
publicação como uma simples alteração de estado no banco interno.

**Consequência.** A configuração do endpoint é dado, não código. O custo é uma
resolução por requisição, que envolve consultas ao banco interno antes de
executar a consulta do usuário.

---

## D8 — Consultas restritas a SELECT, com validação própria

**Decisão.** O MVP aceita apenas `SELECT`. A verificação não se limita a
inspecionar o início da string SQL; será implementada uma camada própria de
validação.

**Justificativa.** O objetivo do trabalho é disponibilização de dados, não
escrita. Além disso, uma verificação superficial de prefixo é contornável, e o
SQL é fornecido pelo próprio usuário da plataforma.

**Consequência.** Comandos de escrita e de DDL são bloqueados. A camada de
validação é um ponto de teste prioritário.

---

## D9 — Parametrização obrigatória das consultas

**Decisão.** Valores recebidos pelos endpoints nunca são concatenados ao SQL. A
consulta usa marcadores posicionais e os valores são enviados separadamente ao
driver.

**Justificativa.** Prevenção de injeção de SQL e preservação da tipagem dos
valores enviados ao PostgreSQL.

**Consequência.** `QueryParameter` guarda `position`, e o runtime monta o array
de valores ordenado por esse campo.

---

## D10 — Limite de registros aplicado pela plataforma

**Decisão.** `Endpoint.maxRows` define um teto de registros, com valor padrão de
1000. O limite é aplicado pela plataforma mesmo quando a consulta original não
possui cláusula de limite.

**Justificativa.** O caso de uso envolve grandes volumes de dados. Depender de o
usuário limitar a própria consulta expõe a plataforma a respostas ilimitadas.

**Consequência.** Toda resposta é limitada. Paginação será tratada
posteriormente.

---

## D11 — Endpoints do MVP são sempre GET

**Decisão.** O modelo `Endpoint` não possui campo `method`.

**Justificativa.** No MVP toda publicação é uma consulta de leitura. Um campo
capaz de armazenar apenas um valor não carrega informação.

**Consequência.** Suporte a outros métodos exigirá alteração de schema e nova
migration, o que é adequado por se tratar de mudança de escopo.

---

## D12 — Portas 5433 e 5434 para os containers PostgreSQL

**Decisão.** O banco da plataforma é exposto na porta 5434 do host e o banco demo
na 5433, ambos mapeados para 5432 dentro do container.

**Justificativa.** A porta 5432 do host está ocupada por uma instalação nativa de
PostgreSQL no Windows.

**Consequência.** A porta do container da plataforma não deve ser alterada para
5432. As URLs de desenvolvimento apontam para `127.0.0.1` nessas portas.

---

## D13 — ownerId temporário no ProjectsModule

**Decisão.** Enquanto não existe autenticação, `CreateProjectDto` recebe
`ownerId` do cliente e a listagem de projetos aceita `ownerId` como filtro
opcional.

**Justificativa.** Permitiu validar o fluxo de projetos sem antecipar a
implementação de autenticação.

**Consequência.** É uma solução provisória, não um fluxo definitivo. Quando o
`AuthModule` existir, `ownerId` deixa de vir do corpo da requisição e passa a ser
obtido do usuário autenticado, com verificação de propriedade nos acessos.

---

## D14 — Slug normalizado no servidor

**Decisão.** O slug do projeto é normalizado pelo backend: remoção de acentos,
conversão para minúsculas e substituição de sequências não alfanuméricas por
hífen. Quando não informado, é derivado do nome do projeto.

**Justificativa.** O slug compõe a URL pública dos endpoints. Normalizar no
servidor garante URLs válidas independentemente do cliente que consome a API.

**Consequência.** A unicidade é garantida pelo índice único em `Project.slug` e
verificada antes da gravação, resultando em conflito quando o slug já existir.

---

## D15 — Domínio meteorológico como base experimental

**Decisão.** O banco `gerador_api_demo` passa a modelar meteorologia, eventos
climáticos e impactos climáticos, distribuídos nos schemas `referencia`,
`meteorologia` e `impactos`. A estrutura e os dados são criados por scripts SQL
próprios em `infra/demo-database/`, sem Prisma.

**Justificativa.** O trabalho precisa demonstrar a disponibilização de grandes
volumes de dados. Séries temporais meteorológicas crescem por construção — o
número de registros é função de estações, frequência de medição e tempo — de
modo que o volume aumenta sem redesenhar o banco. O domínio também produz
naturalmente consultas parametrizadas por estação, município e intervalo, que
é a forma de endpoint que a plataforma publica. O uso de três schemas é
deliberado: exercita a introspecção em ambiente multi-schema, com chaves
estrangeiras atravessando schemas.

**Consequência.** Apenas `meteorologia.observacoes` cresce nos testes de
volume. Os dados são sintéticos e assim declarados na documentação, sem
vínculo com qualquer serviço meteorológico. A estrutura completa está
documentada em `docs/METEOROLOGY_DATABASE.md`. Ver [D2](#d2--prisma-restrito-ao-banco-interno).

---

## D16 — Formato da versão de endpoint

**Decisão.** `Endpoint.version` aceita a letra `v` seguida de um número inteiro
positivo: `v1`, `v2`, `v10`. O padrão é `v1`.

**Justificativa.** A versão compõe a URL pública e precisa de um formato
previsível. Versionamento semântico completo (`v1.2.3`) não agrega ao MVP:
endpoints publicam consultas de leitura, e a única quebra relevante é a
mudança de contrato, que justifica uma nova versão inteira.

**Consequência.** A unicidade da rota é garantida pelo índice
`@@unique([projectId, version, slug])`. Publicar uma variação incompatível de
um endpoint significa criar `v2` com o mesmo slug, mantendo `v1` no ar.
