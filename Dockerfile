FROM node:20-alpine

WORKDIR /app

# Install dependencies needed for running (including tsx and typescript)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Start the server using tsx
EXPOSE 3001
CMD ["npm", "run", "start"]
