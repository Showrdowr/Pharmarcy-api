FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Second stage: production environment
FROM node:20-alpine

WORKDIR /app

# Copy package info
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled source code
COPY --from=builder /app/dist ./dist

# Start the server
EXPOSE 3001
CMD ["npm", "run", "start"]
