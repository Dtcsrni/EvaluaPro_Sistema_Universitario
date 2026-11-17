# [EDICION SERVER / INSTITUCIONAL]
# IMPORTANTE: Este Dockerfile y toda su infraestructura de contenedores ya NO se 
# utiliza para la Edición Docente (el Hub instalador de escritorio de Windows).
# Está preservado EXCLUSIVAMENTE para despliegues institucionales en servidores 
# en la nube o infraestructura universitaria.
# 
# Etapa de build: compila el backend usando el layout del monorepo.
FROM node:24-slim AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install -g npm@12.2.1 node-gyp
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    unzip \
    python3 \
    make \
    g++ \
    cmake \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY CHANGELOG.md ./CHANGELOG.md
COPY config/app-version.json config/version-catalog.json ./config/
COPY tsconfig.base.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/portal_alumno_cloud/package*.json ./apps/portal_alumno_cloud/
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/prisma.config.mjs ./apps/backend/prisma.config.mjs
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/scripts ./apps/backend/scripts
COPY apps/backend/src ./apps/backend/src
# SQLite migrations live at the monorepo root but are executed by the backend
# after startup. Keep them available in the production image.
COPY scripts/migrate-*.mjs ./apps/backend/scripts/
RUN npm ci --foreground-scripts \
  && npm --workspace apps/backend run build

# Etapa runtime: solo runtime real del backend y Chromium necesario para PDF.
FROM node:24-slim AS runner
WORKDIR /app
ARG INSTALL_PLAYWRIGHT=1
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/local/bin/evaluapro-chromium
ARG BUILD_COMMIT=local
ENV GITHUB_SHA=${BUILD_COMMIT}
RUN npm install -g npm@12.2.1
RUN if [ "$INSTALL_PLAYWRIGHT" = "1" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends chromium poppler-utils \
      && ln -s /usr/bin/chromium /usr/local/bin/evaluapro-chromium \
      && rm -rf /var/lib/apt/lists/*; \
    fi
COPY package*.json ./
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md
COPY --from=builder /app/config/app-version.json /app/config/version-catalog.json ./config/
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/portal_alumno_cloud/package*.json ./apps/portal_alumno_cloud/
COPY apps/backend/prisma ./apps/backend/prisma
RUN npm ci --omit=dev --foreground-scripts \
  && npm cache clean --force
# Prisma Client is generated only in the builder (Prisma CLI is a dev dependency).
# Copy its generated runtime into the production stage; otherwise @prisma/client
# resolves to Prisma's empty package shim and the API crashes before listening.
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/apps/backend/scripts ./apps/backend/scripts
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/index.js"]


