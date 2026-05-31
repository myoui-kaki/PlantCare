#!/bin/bash
# ============================================================
# PlantCare — AWS EC2 Deployment Script
# ITST 305 Cloud Computing — Final Project
#
# Run this on a fresh Ubuntu 22.04 EC2 instance:
#   chmod +x deploy_ec2.sh && sudo bash deploy_ec2.sh
#
# EC2 Security Group must allow: SSH (22), HTTP (80), HTTPS (443)
# ============================================================

set -e
echo "🌿 PlantCare — EC2 Deployment Starting..."

# ── 1. System update ──────────────────────────────────────────────────────────
apt-get update -y && apt-get upgrade -y
apt-get install -y python3 python3-pip python3-venv nginx git curl unzip

# ── 2. App directory ──────────────────────────────────────────────────────────
mkdir -p /opt/plantcare
mkdir -p /opt/plantcare/frontend
mkdir -p /opt/plantcare/backend

# ── 3. Copy project files (assumes you scp'd the zip to /tmp/plantcare.zip) ──
# If cloning from GitHub instead, replace these lines with:
#   git clone https://github.com/YOUR_REPO/plantcare.git /opt/plantcare
if [ -f /tmp/plantcare.zip ]; then
    unzip -o /tmp/plantcare.zip -d /opt/plantcare-src
    cp -r /opt/plantcare-src/plantcare-fixed/backend/* /opt/plantcare/backend/
    cp /opt/plantcare-src/plantcare-fixed/index.html \
       /opt/plantcare-src/plantcare-fixed/*.js \
       /opt/plantcare-src/plantcare-fixed/*.css \
       /opt/plantcare-src/plantcare-fixed/*.json \
       /opt/plantcare-src/plantcare-fixed/*.toml \
       /opt/plantcare/frontend/ 2>/dev/null || true
    cp -r /opt/plantcare-src/plantcare-fixed/icons /opt/plantcare/frontend/
    cp -r /opt/plantcare-src/plantcare-fixed/dataset /opt/plantcare/backend/
fi

# ── 4. Python virtual environment & dependencies ─────────────────────────────
cd /opt/plantcare/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ── 5. Environment variables ──────────────────────────────────────────────────
if [ ! -f /opt/plantcare/backend/.env ]; then
    cp .env.example .env
    # Auto-generate JWT secret
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    sed -i "s/CHANGE_ME_TO_A_LONG_RANDOM_SECRET_STRING/$JWT_SECRET/" .env
    sed -i "s/GENERATE_WITH_COMMAND_ABOVE/$FERNET_KEY/" .env
    echo "⚠️  .env created with auto-generated secrets. Edit /opt/plantcare/backend/.env to customize."
fi

# ── 6. Train ML model ─────────────────────────────────────────────────────────
echo "Training ML models..."
python3 train_model.py && echo "✅ ML model trained" || echo "⚠️  ML training failed — check dataset"

# ── 7. Create systemd service ─────────────────────────────────────────────────
cat > /etc/systemd/system/plantcare.service << 'SERVICE'
[Unit]
Description=PlantCare FastAPI Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/plantcare/backend
EnvironmentFile=/opt/plantcare/backend/.env
ExecStart=/opt/plantcare/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable plantcare
systemctl start plantcare
echo "✅ PlantCare backend service started"

# ── 8. Nginx config (reverse proxy + serve frontend) ─────────────────────────
cat > /etc/nginx/sites-available/plantcare << 'NGINX'
server {
    listen 80;
    server_name _;  # Accepts any hostname / IP — change to your domain

    # Serve PWA frontend files
    root /opt/plantcare/frontend;
    index index.html;

    # Security headers (ITEL 305 — Information Assurance)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Service Worker — must be served from root, no cache
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    # Manifest — short cache
    location = /manifest.json {
        add_header Cache-Control "public, max-age=3600";
    }

    # API calls — proxy to FastAPI backend
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Frontend routes — SPA fallback (serves index.html for all routes)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Static assets — long cache
    location ~* \.(css|js|svg|png|jpg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;
    gzip_min_length 1024;
}
NGINX

ln -sf /etc/nginx/sites-available/plantcare /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "✅ Nginx configured and restarted"

# ── 9. Set file permissions ───────────────────────────────────────────────────
chown -R www-data:www-data /opt/plantcare/backend
chmod -R 755 /opt/plantcare/frontend

# ── 10. Summary ───────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "Check AWS Console")
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         🌿 PlantCare — Deployment Complete!              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  🌐 App URL:    http://$PUBLIC_IP"
echo "║  🔧 API Health: http://$PUBLIC_IP/api/health"
echo "║  📁 Frontend:   /opt/plantcare/frontend/"
echo "║  🐍 Backend:    /opt/plantcare/backend/"
echo "║  📋 Logs:       journalctl -u plantcare -f"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📱 PWA Install: Open http://$PUBLIC_IP in mobile browser → Add to Home Screen"
echo "⚠️  For HTTPS (required for push notifications on iOS):"
echo "   1. Point a domain to this IP"
echo "   2. Run: sudo apt install certbot python3-certbot-nginx"
echo "   3. Run: sudo certbot --nginx -d yourdomain.com"
