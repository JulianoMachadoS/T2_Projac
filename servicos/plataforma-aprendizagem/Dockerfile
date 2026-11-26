FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main"]
