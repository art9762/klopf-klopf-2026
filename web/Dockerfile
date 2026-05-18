FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

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

    location /scenario/ {
        proxy_pass http://control:8000/scenario/;
    }

    location /override {
        proxy_pass http://control:8000/override;
    }

    location /metrics/ {
        proxy_pass http://control:8000/metrics/;
    }

    location /health {
        proxy_pass http://control:8000/health;
    }

    location /ws {
        proxy_pass http://control:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
