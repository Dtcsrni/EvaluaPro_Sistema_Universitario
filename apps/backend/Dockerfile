# Etapa de build: instala deps del monorepo y compila el backend.
FROM node:24-slim AS builder
WORKDIR /app
RUN npm install -g npm@11.11.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    cmake \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g node-gyp
COPY package*.json ./
COPY package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/scripts ./apps/backend/scripts
COPY apps/backend/src ./apps/backend/src
RUN npm install --include=optional
RUN npm install --include=optional --workspace apps/backend --os=linux --cpu=x64 --no-save sharp
RUN npm --workspace apps/backend run build

# Etapa runtime: solo dependencias de produccion.
FROM node:24-slim AS runner
WORKDIR /app
ARG INSTALL_PLAYWRIGHT=1
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm install -g npm@11.11.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    cmake \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g node-gyp
COPY package*.json ./
COPY package-lock.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm install --omit=dev --include=optional --workspace apps/backend
RUN npm install --omit=dev --include=optional --workspace apps/backend --os=linux --cpu=x64 --no-save sharp
RUN if [ "$INSTALL_PLAYWRIGHT" = "1" ]; then npm exec --workspace apps/backend -- playwright install --with-deps chromium; else echo "Skipping Playwright install (INSTALL_PLAYWRIGHT=$INSTALL_PLAYWRIGHT)"; fi
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
EXPOSE 4000
CMD ["node", "apps/backend/dist/index.js"]


