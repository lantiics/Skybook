FROM oven/bun:latest

WORKDIR /app

COPY package.json ./
COPY bun.lock ./
COPY src ./src
COPY scripts ./scripts
RUN bun install
ENV port=3000
EXPOSE 3000/tcp


ENTRYPOINT [ "bun", "run", "./src/app.js" ]