FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package to resolve shared dependencies
COPY package*.json ./
RUN npm install

# Copy the shared package and the api package
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build from within apps/api
WORKDIR /app/apps/api
RUN npm install
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY apps/api/package*.json ./
RUN npm install --production

# The dist folder will contain both src/ and packages/ depending on tsc output?
# Wait! Since tsc includes `../../packages/shared`, it will output:
# dist/apps/api/src/...
# dist/packages/shared/...
# Let's just copy the whole dist
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3000

# We need to run from the correct nested path
CMD ["node", "dist/apps/api/src/server.js"]
