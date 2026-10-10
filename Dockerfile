FROM oven/bun:1.4.2

WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY tsconfig.json ./
COPY bun.lock ./
COPY src ./src
COPY scripts ./scripts

RUN bun install --frozen-lockfile --production
ENV PORT=3000
EXPOSE 3000/tcp
USER bun

ENTRYPOINT [ "bun", "run", "./src/app.js" ]