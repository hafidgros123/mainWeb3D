FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS frontend-build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
COPY . .
RUN npm run build

FROM nginx:alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

FROM node:22-alpine AS api-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=api-dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY serverless-side ./serverless-side
COPY src/three/animations.js ./src/three/animations.js
EXPOSE 3001
CMD ["node", "serverless-side/start.js"]
