FROM node:20-slim

# Install OpenSSL (for Prisma) and FFMPEG
RUN apt-get update -y && apt-get install -y openssl ffmpeg

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate && npx prisma db push

# Start the application
CMD ["npm", "start"]
