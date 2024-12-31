FROM node:20-bookworm-slim as builder

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install the app dependencies
RUN npm install -g pnpm
RUN pnpm install

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]