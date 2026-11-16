FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./backend/

WORKDIR /app/backend

RUN npm ci --omit=dev

WORKDIR /app

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
