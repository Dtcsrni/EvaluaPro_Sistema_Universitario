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
RUN npm install -g npm@11.11.0 node-gyp
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
COPY tsconfig.base.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/portal_alumno_cloud/package*.json ./apps/portal_alumno_cloud/
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/scripts ./apps/backend/scripts
COPY apps/backend/src ./apps/backend/src
RUN npm ci --foreground-scripts \
  && npm --workspace apps/backend run build

# Etapa runtime: solo runtime real del backend y Chromium necesario para PDF.
FROM node:24-slim AS runner
WORKDIR /app
ARG INSTALL_PLAYWRIGHT=1
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/local/bin/evaluapro-chromium
RUN npm install -g npm@11.11.0
RUN if [ "$INSTALL_PLAYWRIGHT" = "1" ]; then \
      apt-get update \
      && apt-get install -y --no-install-recommends chromium \
      && ln -s /usr/bin/chromium /usr/local/bin/evaluapro-chromium \
      && rm -rf /var/lib/apt/lists/*; \
    fi
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/portal_alumno_cloud/package*.json ./apps/portal_alumno_cloud/
COPY apps/backend/prisma ./apps/backend/prisma
RUN npm ci --omit=dev --foreground-scripts \
  && npm cache clean --force
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/index.js"]


