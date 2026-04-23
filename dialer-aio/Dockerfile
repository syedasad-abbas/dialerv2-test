FROM node:20-slim

WORKDIR /app

# Debug/health tooling used during production troubleshooting
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl sngrep \
  && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY index.js ./

# Run with --expose-gc so the memory monitor can trigger manual GC
CMD ["sh", "-c", "sleep 30 && node --expose-gc index.js"]
