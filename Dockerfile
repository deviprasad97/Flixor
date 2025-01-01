# Author: Flixor
# App Name: Flixor

FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install the app dependencies
RUN npm install -g pnpm
RUN pnpm install

COPY . .

# Build the application
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]