FROM node:20-alpine

WORKDIR /app

# Copy root package and subprojects
COPY package.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies and build
RUN npm run install:all
COPY . .
RUN npm run build

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["npm", "start"]
