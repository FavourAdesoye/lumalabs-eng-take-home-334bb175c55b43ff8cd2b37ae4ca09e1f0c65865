# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

COPY client ./client
COPY server ./server

RUN npm run build \
  && mkdir -p server/data \
  && npm run seed --workspace server \
  && npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "server"]
