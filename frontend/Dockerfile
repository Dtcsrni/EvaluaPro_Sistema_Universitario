# Build stage: compile the static frontend bundle.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src
RUN npm install
ARG VITE_API_BASE_URL=http://localhost:4000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Runtime stage: serve the static bundle with a tiny server.
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
