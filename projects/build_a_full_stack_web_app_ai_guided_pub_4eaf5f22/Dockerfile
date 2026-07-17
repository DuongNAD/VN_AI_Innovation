# Only digest-pinned references are approved (format node:20-alpine@sha256:<digest>) and are supplied by the controlled build.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --ignore-scripts
RUN npx prisma generate

COPY tsconfig.json ./
COPY next.config.mjs ./
COPY tailwind.config.ts ./
COPY postcss.config.mjs ./
COPY src ./src
COPY public ./public

RUN npm run build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run db:bootstrap && npm run start"]
