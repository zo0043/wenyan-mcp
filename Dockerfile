# Build stage
FROM docker.xuanyuan.me/library/node:24 AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/
RUN pnpm install

# Copy source code
COPY src ./src

# Build project
RUN pnpm run build

# Production stage
FROM docker.xuanyuan.me/library/node:24

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE ${PORT}

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
