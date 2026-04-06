# Etapa de build: compila el backend usando el layout del monorepo.
FROM node:24-slim AS builder
WORKDIR /app
RUN npm install -g npm@11.11.0 node-gyp
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    cmake \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/scripts ./apps/backend/scripts
COPY apps/backend/src ./apps/backend/src
RUN npm install --include=optional \
  && npm install --include=optional --workspace apps/backend --os=linux --cpu=x64 --no-save sharp \
  && npm --workspace apps/backend run build

# Etapa runtime: solo runtime real del backend y Chromium necesario para PDF.
FROM node:24-slim AS runner
WORKDIR /app/apps/backend
ARG INSTALL_PLAYWRIGHT=1
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/local/bin/evaluapro-chromium
RUN npm install -g npm@11.11.0
COPY apps/backend/package*.json ./
RUN npm ci --omit=dev --include=optional \
  && npm install --omit=dev --include=optional --os=linux --cpu=x64 --no-save sharp \
  && if [ "$INSTALL_PLAYWRIGHT" = "1" ]; then npx playwright install --with-deps --no-shell chromium; else echo "Skipping Playwright install (INSTALL_PLAYWRIGHT=$INSTALL_PLAYWRIGHT)"; fi \
  && if [ "$INSTALL_PLAYWRIGHT" = "1" ]; then node -e "const { chromium } = require('playwright'); process.stdout.write(chromium.executablePath())" > /tmp/chromium-path; actual_path=$(tr -d '\"\\r' < /tmp/chromium-path); printf '%s\n' '#!/bin/sh' "exec \"$actual_path\" \"\$@\"" > /usr/local/bin/evaluapro-chromium; chmod +x /usr/local/bin/evaluapro-chromium; rm -f /tmp/chromium-path; rm -rf /ms-playwright/ffmpeg-* /ms-playwright/*headless*; fi \
  && npm cache clean --force
COPY --from=builder /app/apps/backend/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]


