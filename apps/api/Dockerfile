# Imagem da API NestJS.
#
# O contexto de build e a raiz do monorepo, porque o lockfile e o
# pnpm-workspace.yaml vivem la. Construir a partir de apps/api nao
# permitiria uma instalacao reproduzivel.
#
#   docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=24-alpine

# ---------------------------------------------------------------------
# Dependencias: camada separada para que alterar codigo nao refaca a
# instalacao.
# ---------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/

# `--filter api...` traz apenas a API e suas dependencias de workspace.
# O lockfile e obrigatorio: sem ele a instalacao nao seria reproduzivel.
RUN pnpm install --frozen-lockfile --filter api...

# ---------------------------------------------------------------------
# Build: gera o Prisma Client e compila o TypeScript.
# ---------------------------------------------------------------------
FROM deps AS build

WORKDIR /app

COPY apps/api apps/api

# O cliente e gerado dentro da imagem, nunca copiado da maquina local.
#
# `prisma generate` apenas emite codigo, mas a configuracao exige que
# DATABASE_URL resolva. O valor abaixo e um placeholder de build: vive
# so nesta linha e nao entra na imagem. A URL real chega por ambiente
# no momento da execucao.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
  pnpm --filter api exec prisma generate \
  && pnpm --filter api build

# Remove o que so servia para compilar. As dependencias de
# desenvolvimento restantes incluem o CLI do Prisma, usado para aplicar
# as migrations na inicializacao.
RUN pnpm prune --prod --no-optional || true

# ---------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production
ENV PORT=3001

# Sem pnpm nesta camada: os binarios ja estao instalados, e depender do
# corepack aqui faria a inicializacao baixar o gerenciador da rede.
WORKDIR /app

# O usuario `node` ja existe na imagem base; a aplicacao nao roda como
# root.
COPY --from=build --chown=node:node /app /app

USER node

WORKDIR /app/apps/api

EXPOSE 3001

# `migrate deploy` aplica as migrations existentes sem gerar novas e sem
# recriar o banco, que e o comportamento adequado fora de
# desenvolvimento.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main"]
