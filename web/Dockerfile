FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://control:8000/;
    }

    location /ws {
        proxy_pass http://control:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $websocket_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
