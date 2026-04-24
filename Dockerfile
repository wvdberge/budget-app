FROM node:20
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server source and pre-built client
COPY server/ ./
COPY client/dist ./public

RUN mkdir -p /data

ENV PORT=3000
ENV DB_PATH=/data/budget.db

EXPOSE 3000
CMD ["node", "index.js"]
