# Controlled builds may override with a digest-pinned reference (node:20-alpine@sha256:<digest>);
# the default keeps `docker build` and the Render deploy working without extra args.
ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE}

WORKDIR /app

RUN apk add --no-cache poppler-utils

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --ignore-scripts
RUN npx prisma generate

COPY tsconfig.json ./
COPY next.config.mjs ./
COPY tailwind.config.ts ./
COPY postcss.config.mjs ./
# Served at runtime by /api/openapi (readFileSync from process.cwd()).
COPY openapi.yaml ./
COPY src ./src
COPY public ./public

RUN npm run build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run db:bootstrap && npm run start"]
