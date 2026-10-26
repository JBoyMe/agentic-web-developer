FROM node:24-alpine

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8787 \
    HOST=0.0.0.0

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY schema.sql ./

RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/health >/dev/null 2>&1 || exit 1

USER node
CMD ["node", "src/server.mjs"]
