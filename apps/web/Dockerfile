# Imagem do painel Next.js.
#
# Assim como a da API, e construida a partir da raiz do monorepo:
#
#   docker build -f apps/web/Dockerfile .
#
# A saida `standalone` do Next foi avaliada e descartada: com o layout
# de node_modules do pnpm o rastreamento de arquivos copia dependencias
# transitivas do proprio Next pela metade, e o servidor nao sobe. Levar
# node_modules para a imagem custa alguns megabytes e nao depende de
# heuristica de empacotamento.

ARG NODE_VERSION=24-alpine

# ---------------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --filter web...

# ---------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------
FROM deps AS build

# NEXT_PUBLIC_* e embutido no bundle em tempo de build, entao precisa
# ser conhecido aqui. O valor e o endereco que o NAVEGADOR usa: dentro
# do compose a API tambem atende como `api:3001`, mas esse nome nao
# resolve no navegador do host.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY apps/web apps/web

RUN pnpm --filter web build

# Descarta as dependencias que so serviam para compilar.
RUN pnpm prune --prod --no-optional || true

# ---------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Sem pnpm nesta camada: chamar o binario local evita que a
# inicializacao dependa de baixar o gerenciador da rede.
WORKDIR /app

COPY --from=build --chown=node:node /app /app

USER node

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["./node_modules/.bin/next", "start"]
