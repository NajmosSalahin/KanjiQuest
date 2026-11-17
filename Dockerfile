# syntax=docker/dockerfile:1
# Kanji Garden — multi-stage image for the API and the built client (D27).
#
#   docker build --target api -t kanjiquest-api .
#   docker build --target client -t kanjiquest-client .
#
# docker-compose.yml builds both to run the whole stack locally. There is
# intentionally no MongoDB service (D1): the API connects to MONGODB_URI.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Install workspaces against the lockfile before copying source so the layer
# cache survives application edits.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# ---- API ---------------------------------------------------------------
FROM deps AS api
# Render and docker-compose override this as needed. Production keeps Secure
# cookies; the compose file sets development because it serves plain HTTP.
ENV NODE_ENV=production
COPY shared/ shared/
COPY server/ server/
EXPOSE 4000
# MONGODB_URI, JWT_* and other secrets come from the environment (Render
# dashboard or compose env_file) — never baked into the image.
CMD ["npm", "run", "start", "-w", "server"]

# ---- Client build ------------------------------------------------------
FROM deps AS client-build
COPY shared/ shared/
COPY client/ client/
RUN npm run build -w client

# ---- Client runtime ----------------------------------------------------
# nginx serves the SPA and proxies /api, /uploads and /health to the API so
# browser cookies stay same-origin (prompt.md §14).
FROM nginx:1.27-alpine AS client
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/client/dist /usr/share/nginx/html
EXPOSE 80
