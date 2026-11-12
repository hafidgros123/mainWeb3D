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

FROM dependencies AS api
WORKDIR /app
ENV NODE_ENV=production
COPY wrangler.toml ./
COPY worker ./worker
COPY src/three/animations.js ./src/three/animations.js
EXPOSE 3001
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "3001"]
