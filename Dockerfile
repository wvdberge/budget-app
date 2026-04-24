# Stage 1: build the React client
FROM node:20-alpine AS client-build
WORKDIR /build/client
COPY client/package*.json ./
RUN npm install --include=dev
COPY client/ ./
RUN npm run build

# Stage 2: production image
# node:20 (Debian) includes python3/make/g++ for native modules — no apk needed
FROM node:20
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server source
COPY server/ ./

# Copy client build into server's public directory
COPY --from=client-build /build/client/dist ./public

# Data directory (overridden by volume mount in production)
RUN mkdir -p /data

ENV PORT=3000
ENV DB_PATH=/data/budget.db

EXPOSE 3000
CMD ["node", "index.js"]
