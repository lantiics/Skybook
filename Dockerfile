FROM oven/bun:latest


COPY package.json ./
COPY bun.lock ./
COPY src ./src
COPY .env.example ./.env
COPY config.sample.toml ./config.toml
RUN bun install
ENV port=3000
EXPOSE 3000/tcp


ENTRYPOINT [ "bun", "run", "./src/app.js" ]