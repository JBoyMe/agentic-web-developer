# Canonical image for the credits proxy.
#
# This file lives at the repository root on purpose. Render builds with the
# repo root as the Docker context and reads ./Dockerfile by default, so a root
# Dockerfile works whether the service is created from render.yaml or by hand
# as a "Docker" web service with no root-directory setting.
#
# The app itself still lives in server/credits; only the COPY paths differ from
# a build started inside that folder.
FROM node:24-alpine

# su-exec lets the entrypoint hand a root-owned volume to the app user, which
# is what Render (and most bind mounts) require. wget is used by HEALTHCHECK.
RUN apk add --no-cache su-exec wget

# PORT is intentionally left unset: config.mjs defaults to 8787, but Render and
# most platforms inject their own PORT at runtime and the healthcheck below
# follows it. Hard-coding it here would make the container report unhealthy.
ENV NODE_ENV=production \
    DATA_DIR=/data \
    HOST=0.0.0.0

WORKDIR /app

COPY server/credits/package.json ./
COPY server/credits/src ./src
COPY server/credits/schema.sql ./
COPY server/credits/deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /data

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8787}/health" >/dev/null 2>&1 || exit 1

# Runs as root only long enough to chown the data volume, then drops to `node`.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "src/server.mjs"]
