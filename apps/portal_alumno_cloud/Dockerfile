# Etapa de build: compila TypeScript del portal alumno.
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g npm@11.11.0
COPY package*.json ./
COPY apps/portal_alumno_cloud/package*.json ./apps/portal_alumno_cloud/
COPY tsconfig.base.json ./
COPY apps/portal_alumno_cloud/tsconfig.json ./apps/portal_alumno_cloud/
COPY apps/portal_alumno_cloud/src ./apps/portal_alumno_cloud/src
RUN npm install
RUN npm --workspace apps/portal_alumno_cloud run build

# Etapa runtime: dependencias de produccion.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g npm@11.11.0
COPY package*.json ./
COPY apps/portal_alumno_cloud/package*.json ./apps/portal_alumno_cloud/
RUN npm install --omit=dev --workspace apps/portal_alumno_cloud
COPY --from=builder /app/apps/portal_alumno_cloud/dist ./apps/portal_alumno_cloud/dist
EXPOSE 8080
CMD ["node", "apps/portal_alumno_cloud/dist/index.js"]
