FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=http://127.0.0.1:3100
ARG VITE_PORTAL_WS_URL=ws://127.0.0.1:18081

COPY package*.json ./
RUN npm ci
COPY . .

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_PORTAL_WS_URL=${VITE_PORTAL_WS_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8088
CMD ["nginx", "-g", "daemon off;"]
