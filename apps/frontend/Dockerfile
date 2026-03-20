# Etapa de build: compila el bundle estatico del frontend.
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g npm@11.11.0
COPY package*.json ./
COPY package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY apps/frontend/tsconfig*.json ./apps/frontend/
COPY apps/frontend/vite.config.ts ./apps/frontend/
COPY apps/frontend/index.html ./apps/frontend/
COPY apps/frontend/public ./apps/frontend/public
COPY apps/frontend/src ./apps/frontend/src
RUN npm install --workspace apps/frontend --include=dev --include-workspace-root=false
ARG VITE_API_BASE_URL=http://localhost:4000/api
ARG VITE_APP_DESTINO=docente
ARG VITE_PORTAL_BASE_URL=http://localhost:8080/api/portal
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_DESTINO=$VITE_APP_DESTINO
ENV VITE_PORTAL_BASE_URL=$VITE_PORTAL_BASE_URL
RUN npm --workspace apps/frontend run build

# Etapa runtime: sirve el bundle estatico con Nginx y fallback SPA.
FROM nginx:alpine AS runner
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 4173
CMD ["nginx", "-g", "daemon off;"]
