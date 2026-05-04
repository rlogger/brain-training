FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p /app/data
ENV PORT=8090
ENV DB_PATH=/app/data/brain-training.sqlite
EXPOSE 8090
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
