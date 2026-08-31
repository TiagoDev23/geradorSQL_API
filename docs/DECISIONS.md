# Decisões técnicas

Decisões vigentes e suas justificativas. Quando uma decisão substitui outra, o
registro correspondente é atualizado e a abordagem anterior fica indicada.

---

## D1 — Monólito modular em vez de microserviços

**Decisão.** Um único processo NestJS, organizado em módulos, com separação
lógica entre Control Plane e Data Plane.

**Motivo.** Escopo delimitado e um único desenvolvedor. Microserviços
acrescentariam custo de operação e observabilidade sem benefício correspondente.

**Consequência.** A separação vem de módulos e serviços, não de fronteiras de
rede.

---

## D2 — Prisma restrito ao banco interno

**Decisão.** O Prisma é usado exclusivamente no banco da plataforma. Bancos
externos são acessados apenas por `node-postgres`.

**Motivo.** O Prisma pressupõe schema conhecido em tempo de desenvolvimento e
client gerado estaticamente. Os bancos dos usuários têm schema arbitrário,
descoberto em execução. Gerar client dinamicamente seria custoso e frágil.

**Consequência.** Não existe schema Prisma nem migration para banco de usuário.
Introspecção e execução usam SQL direto sobre `pg_catalog`.

---

## D3 — URL do banco fora do schema.prisma

**Decisão.** O `datasource` declara apenas o provider; a URL é resolvida em
`prisma.config.ts` a partir de `DATABASE_URL`.

**Motivo.** Formato do Prisma 7 e forma de manter credenciais fora de arquivos
versionados.

**Consequência.** Os comandos da CLI dependem de `DATABASE_URL` no ambiente.

---

## D4 — CommonJS com Node16, sem conversão para ESM

**Decisão.** O backend permanece em `module: Node16` / `moduleResolution: Node16`,
sem `"type": "module"` e sem extensão `.js` nos imports. O Prisma Client é gerado
com `moduleFormat = "cjs"`.

**Motivo.** É a configuração estável para o conjunto NestJS 11 + Prisma 7
adotado; migrar para ESM traria risco sem ganho funcional.

**Consequência.** A conversão só deve ser feita diante de necessidade real.

---

## D5 — AES-256-GCM para credenciais de bancos externos

**Decisão.** Senhas de conexões externas são cifradas com AES-256-GCM. A chave de
32 bytes vem de `CONNECTION_ENCRYPTION_KEY`.

**Motivo.** A aplicação precisa recuperar a senha em texto puro para abrir a
conexão, o que exclui hashing. Sendo necessária criptografia reversível, um modo
autenticado permite detectar adulteração do ciphertext.

**Consequência.** O valor armazenado concatena IV, authentication tag e
ciphertext em hexadecimal, com IV aleatório por operação. A chave nunca vai ao
banco e `passwordEncrypted` nunca é exposto por API.

---

## D6 — API Keys armazenadas apenas como hash

**Decisão.** O token completo é exibido uma única vez, na criação. O banco guarda
`keyHash` e `keyPrefix`.

**Motivo.** A chave é um segredo de portador. Armazenar apenas o hash limita o
impacto de um vazamento do banco interno; o prefixo permite identificar
visualmente qual chave é qual.

**Consequência.** Uma chave perdida não pode ser recuperada, apenas revogada e
substituída.

---

## D7 — Runtime dinâmico em vez de geração de código

**Decisão.** Publicar um endpoint não gera arquivos. Uma rota genérica resolve
projeto, versão e slug em tempo de requisição.

**Motivo.** Geração de código exigiria escrita em disco e recompilação a cada
publicação, tornando uma operação imediata dependente do ciclo de build.

**Consequência.** A configuração do endpoint é dado, não código. O custo é uma
resolução por requisição no banco interno antes de executar a consulta.

---

## D8 — Consultas restritas a SELECT, com validação própria

**Decisão.** Apenas leitura. A validação normaliza comentários, literais,
dollar quoting e identificadores antes de analisar o que sobra.

**Motivo.** O objetivo é disponibilização de dados, não escrita. Verificar o
prefixo da string é contornável — um comando escondido após um comentário
passaria.

**Consequência.** Comandos de escrita, DDL e múltiplas instruções são bloqueados,
tanto ao gravar quanto ao executar. É um ponto de teste prioritário.

---

## D9 — Parametrização obrigatória

**Decisão.** Valores recebidos nunca são concatenados ao SQL: a consulta usa
marcadores posicionais e os valores vão separados ao driver.

**Motivo.** Prevenção de injeção e preservação da tipagem enviada ao PostgreSQL.

**Consequência.** `QueryParameter` guarda `position`, e o array de valores é
montado nessa ordem. Valores fora do tipo declarado são recusados antes de abrir
conexão.

---

## D10 — Limite de registros aplicado pela plataforma

**Decisão.** `Endpoint.maxRows` define um teto, padrão 1000, aplicado mesmo
quando a consulta original não tem cláusula de limite.

**Motivo.** O caso de uso envolve grandes volumes. Depender de o usuário limitar
a própria consulta expõe a plataforma a respostas ilimitadas.

**Consequência.** O limite envolve a consulta original sem reescrevê-la, e a
resposta indica `truncated` quando o corte pode ter escondido registros.
Paginação sobre SQL arbitrário ficou fora do MVP.

---

## D11 — Endpoints do MVP são sempre GET

**Decisão.** O modelo `Endpoint` não possui campo `method`.

**Motivo.** Toda publicação é uma consulta de leitura; um campo com um único
valor possível não carrega informação.

**Consequência.** Outros métodos exigirão alteração de schema e nova migration,
o que é adequado por se tratar de mudança de escopo.

---

## D12 — Portas 5434 e 5435 para os containers PostgreSQL

**Decisão.** O banco da plataforma é exposto em 5434 e o demo em 5435, ambos
mapeados para 5432 dentro do container.

**Motivo.** As portas 5432 e 5433 do host já estão ocupadas por instalações
nativas de PostgreSQL no ambiente de desenvolvimento.

**Consequência.** As portas do host não devem voltar para 5432 ou 5433. Dentro da
rede do compose, os serviços se alcançam pelo nome e pela porta 5432.

---

## D13 — JWT no control plane e ownership por usuário

**Decisão.** O painel autentica por JWT com guard global; rotas públicas são
explicitamente marcadas. Todo recurso é verificado pela cadeia de posse até o
`User`, e acesso a recurso de outro proprietário responde 404.

**Motivo.** Substitui a solução provisória anterior, em que `ownerId` vinha do
corpo da requisição enquanto não havia autenticação. Responder 403 confirmaria a
existência do recurso de outro usuário.

**Consequência.** `ownerId` nunca vem do cliente. O runtime fica fora desse
guard: é autenticado por API Key, não por JWT.

---

## D14 — Slug normalizado no servidor

**Decisão.** O slug é normalizado pelo backend — sem acentos, minúsculo, com
sequências não alfanuméricas viradas hífen — e derivado do nome quando ausente.

**Motivo.** O slug compõe a URL pública; normalizar no servidor garante URLs
válidas independentemente do cliente.

**Consequência.** A unicidade é garantida por índice único e verificada antes da
gravação, resultando em conflito quando já existir.

---

## D15 — Domínio meteorológico como base de demonstração

**Decisão.** O banco `gerador_api_demo` modela meteorologia, eventos e impactos
climáticos em três schemas, criados por scripts SQL próprios em
`infra/demo-database/`, sem Prisma ([D2](#d2--prisma-restrito-ao-banco-interno)).

**Motivo.** Séries temporais crescem por construção — o volume é função de
estações, frequência e tempo — sem redesenhar o banco. O domínio produz
naturalmente consultas parametrizadas por estação e intervalo, e os três schemas
exercitam a introspecção com chaves estrangeiras cruzando schemas.

**Consequência.** Os dados são sintéticos e declarados como tais, sem vínculo com
qualquer serviço meteorológico. Estrutura em
[METEOROLOGY_DATABASE](METEOROLOGY_DATABASE.md).

---

## D16 — Formato da versão de endpoint

**Decisão.** `Endpoint.version` aceita `v` seguido de inteiro positivo — `v1`,
`v2`, `v10` — com padrão `v1`.

**Motivo.** A versão compõe a URL e precisa de formato previsível. Versionamento
semântico completo não agrega: a única quebra relevante é mudança de contrato.

**Consequência.** A rota é única por `@@unique([projectId, version, slug])`.
Publicar variação incompatível significa criar `v2` mantendo `v1` no ar.

---

## D17 — OpenAPI em JSON, sem Swagger UI

**Decisão.** A especificação OpenAPI é gerada por projeto e servida em JSON; não
há interface de documentação embarcada.

**Motivo.** O wrapper usual do NestJS monta um documento estático no boot,
enquanto aqui a especificação varia por projeto e é gerada sob demanda. Servir a
interface exigiria dependência nova e rota de assets por projeto, sem acrescentar
capacidade ao MVP.

**Consequência.** O painel apresenta o documento em resumo e em JSON, que pode
ser aberto em qualquer visualizador de OpenAPI.

---

## D18 — CodeMirror 6 como editor SQL

**Decisão.** O editor do painel usa CodeMirror 6, com realce de sintaxe e
numeração de linhas, sem autocomplete.

**Motivo.** Substitui o Monaco previsto no planejamento inicial: seu wrapper
oficial carrega o editor de uma CDN por padrão, o que introduziria dependência
externa em tempo de execução, e empacotá-lo exigiria configuração de bundler
desproporcional.

**Consequência.** A validação de SQL permanece exclusivamente no backend;
duplicá-la no navegador abriria espaço para as duas divergirem.

---

## D19 — Migrations aplicadas na inicialização do container

**Decisão.** A imagem da API executa `prisma migrate deploy` antes de subir o
servidor.

**Motivo.** Aplica as migrations existentes sem gerar novas e sem recriar o
banco, que é o comportamento adequado fora de desenvolvimento.

**Consequência.** Subir a stack em um banco já migrado é uma operação sem efeito.
O Prisma Client é gerado dentro da imagem, nunca copiado da máquina local.
