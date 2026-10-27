# Образ с игровым сервером и собранным сайтом: один процесс раздаёт и игру, и страницу.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/content/package.json packages/content/
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/sim/package.json packages/sim/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:web

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production PORT=8080 KAPITAL_DATA_DIR=/data
COPY --from=build /app /app
# база, секрет шифрования и сохранения живут на постоянном диске, смонтированном в /data
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 8080
CMD ["pnpm", "start"]
