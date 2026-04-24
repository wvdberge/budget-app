# Stage 1: build the React client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: production server
FROM node:20
WORKDIR /app

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/ ./
COPY --from=client-build /app/client/dist ./public

RUN mkdir -p /data

ENV PORT=3000
ENV DB_PATH=/data/budget.db

EXPOSE 3000
CMD ["node", "index.js"]
