# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Coolify injects this during build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 2: Run (Production)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# These 3 lines are the "Secret Sauce" for Standalone Mode
# COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
# Important for Docker networking
ENV HOSTNAME="0.0.0.0" 

# Use node to run the standalone server instead of npm start
CMD ["node", "server.js"]