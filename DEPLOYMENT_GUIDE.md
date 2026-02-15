# 🚀 PANDUAN LENGKAP DEPLOYMENT VPS - SISTEM ABSENSI

## 📋 DAFTAR ISI
1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Reverse Proxy (Nginx)](#reverse-proxy-nginx)
6. [Testing & Troubleshooting](#testing--troubleshooting)
7. [Production Optimization](#production-optimization)

---

## Prerequisites

### Server Requirements
- **OS**: Ubuntu 20.04+ / CentOS / Debian
- **Node.js**: v16+ (rekomendasi v18 LTS)
- **MySQL**: v5.7+ / v8.0+
- **RAM**: Min 2GB (rekomendasi 4GB+)
- **Storage**: Min 10GB free space

### Tools yang Diperlukan
```bash
# Install Node.js & npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL Client
sudo apt-get install -y mysql-client

# Install PM2 (untuk manage process)
sudo npm install -g pm2

# Install Nginx (untuk reverse proxy)
sudo apt-get install -y nginx
```

---

## Database Setup

### Step 1: Buat Database & User

```bash
# Login ke MySQL
mysql -u root -p

# Di MySQL console, jalankan:
CREATE DATABASE absensi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Buat user baru (rekomendasi, jangan gunakan root)
CREATE USER 'absensi_user'@'localhost' IDENTIFIED BY 'Strong@Password123';
GRANT ALL PRIVILEGES ON absensi.* TO 'absensi_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 2: Cek Connection
```bash
# Test koneksi ke database
mysql -u absensi_user -p -h localhost -e "SELECT 1;"
# Masukkan password yang sudah dibuat
```

### Step 3: Backup & Restore (Jika Ada Data Lama)
```bash
# Jika ada database lama yang perlu dimigrate:
mysqldump -u root -p old_absensi > backup_absensi.sql

# Restore ke database baru:
mysql -u absensi_user -p absensi < backup_absensi.sql
```

---

## Backend Setup

### Step 1: Clone/Upload Project

```bash
# Navigate ke home directory
cd /home/username

# Clone project (atau upload via SFTP)
git clone <your-repo-url> absensi-app
cd absensi-app/api-absensi
```

### Step 2: Konfigurasi Environment

```bash
# Copy template file
cp .env.production.example .env

# Edit file .env dengan text editor
nano .env
```

**Update nilai berikut:**
```env
DATABASE_URL="mysql://absensi_user:Strong@Password123@localhost:3306/absensi"
JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
APP_ENV="production"
PORT=4000
ORIGIN="http://185.xxx.xxx.xxx:3000"
```

### Step 3: Install Dependencies & Setup Database

```bash
# Install npm packages
npm install

# Setup Prisma & migrations
npx prisma migrate deploy

# (Opsional) Seed data jika ada
npx prisma db seed
```

### Step 4: Start Backend dengan PM2

```bash
# Start server
pm2 start src/index.js --name "api-absensi"

# Cek status
pm2 status

# Lihat logs
pm2 logs api-absensi

# Save PM2 config (agar auto-start saat reboot)
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u username --hp /home/username
```

### Step 5: Test Backend

```bash
# Test endpoint (dari VPS terminal)
curl http://localhost:4000/api/pegawai
# Harusnya return error 401 (belum login), tapi endpoint accessible

# Atau dari mesin lain:
curl http://185.xxx.xxx.xxx:4000/api/pegawai
```

---

## Frontend Setup

### Step 1: Navigate ke Frontend Folder

```bash
cd /home/username/absensi-app/aplikasi-absensi-nextjs
```

### Step 2: Konfigurasi Environment

```bash
# Buat file .env.local
nano .env.local
```

**Tambahkan:**
```env
NEXT_PUBLIC_API_URL=http://185.xxx.xxx.xxx:4000
```

**ATAU jika menggunakan Nginx reverse proxy:**
```env
NEXT_PUBLIC_API_URL=http://185.xxx.xxx.xxx/api
```

### Step 3: Build & Start Frontend

```bash
# Install dependencies
npm install

# Build untuk production
npm run build

# Start server
pm2 start npm --name "frontend-absensi" -- start

# Cek status
pm2 status

# Lihat logs
pm2 logs frontend-absensi
```

### Step 4: Test Frontend

Buka browser dan akses: `http://185.xxx.xxx.xxx:3000`

---

## Reverse Proxy (Nginx)

> **Opsional tapi Recommended untuk production**

### Step 1: Backup Nginx Config

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
```

### Step 2: Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/absensi
```

**Tambahkan konfigurasi:**
```nginx
# Upstream untuk backend API
upstream backend {
    server 127.0.0.1:4000;
}

# Upstream untuk frontend
upstream frontend {
    server 127.0.0.1:3000;
}

# HTTP redirect ke HTTPS (optional, jika pakai SSL)
# server {
#     listen 80;
#     server_name 185.xxx.xxx.xxx yourdomain.com;
#     return 301 https://$server_name$request_uri;
# }

# Main server block
server {
    listen 80;
    server_name 185.xxx.xxx.xxx yourdomain.com;

    # Proxy untuk API
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy untuk frontend Next.js
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static files
    location ~* \.(?:jpg|jpeg|gif|png|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Step 3: Enable Nginx Config

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/absensi /etc/nginx/sites-enabled/

# Test config syntax
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Cek status
sudo systemctl status nginx
```

---

## Testing & Troubleshooting

### ✅ Test 1: Database Connection

```bash
# Dari VPS terminal:
mysql -u absensi_user -p -h localhost -e "SELECT COUNT(*) as pegawai_count FROM absensi.pegawai;"

# Expected: Column header "pegawai_count" dan jumlah employee
```

### ✅ Test 2: Backend API

```bash
# Test pegawai endpoint (should return 401 unauthorized, but accessible)
curl -v http://localhost:4000/api/pegawai

# Expected: Status code 401, "unauthorized" message
# NOT OK: Connection refused, timeout, 502 bad gateway
```

### ✅ Test 3: Frontend Load

```bash
# Navigate ke VPS in browser:
http://185.xxx.xxx.xxx:3000

# Expected: 
# - Login page loads
# - No CORS errors in browser console (F12)
# - Network tab shows successful API calls after login
```

### ✅ Test 4: Login & Data Load

1. Login dengan credentials admin
2. Buka halaman "Pegawai" → Check apakah data muncul
3. Buka halaman "Data Absen Pegawai" → Check apakah data muncul
4. Buka DevTools (F12):
   - Console tab: Cek untuk error messages
   - Network tab: Cek API calls status

### ❌ Troubleshooting: Common Issues

#### Issue 1: "Connection Refused"
```
Error: connect ECONNREFUSED 127.0.0.1:4000
```
**Solusi:**
```bash
# Check apakah backend running
pm2 status

# Jika tidak running, lihat error
pm2 logs api-absensi

# Restart
pm2 restart api-absensi
```

#### Issue 2: "CORS Blocked"
```
Access to XMLHttpRequest at 'http://...' from origin 'http://...' has been blocked by CORS policy
```
**Solusi:**
- Periksa `ORIGIN` di `.env` backend
- Pastikan format URL benar (dengan port jika perlu)
- Restart backend: `pm2 restart api-absensi`

#### Issue 3: "Pegawai Data Kosong"
**Solusi:**
```bash
# Cek data di database
mysql -u absensi_user -p absensi -e "SELECT * FROM pegawai LIMIT 5;"

# Jika kosong, perlu seed/tambah data manual
# Atau jalankan seed script jika ada
npx prisma db seed
```

#### Issue 4: "Database Connection Error"
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Solusi:**
```bash
# Cek MySQL service
sudo systemctl status mysql
sudo systemctl start mysql

# Cek DATABASE_URL di .env
cat .env | grep DATABASE_URL

# Test connection
mysql -u absensi_user -p -h localhost
```

#### Issue 5: "502 Bad Gateway" (Jika pakai Nginx)
**Solusi:**
```bash
# Test Nginx config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Verify upstream (backend) running
curl http://localhost:4000/api/pegawai
```

---

## Production Optimization

### 1. Enable PM2 Auto-Restart

```bash
# Save PM2 config untuk auto-start saat reboot
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u username --hp /home/username
```

### 2. Setup SSL/TLS (HTTPS)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot certonly --nginx -d yourdomain.com

# Update Nginx config untuk HTTPS
# (Edit /etc/nginx/sites-available/absensi dan uncomment HTTPS section)

# Restart Nginx
sudo systemctl restart nginx
```

### 3. Setup Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 4. Monitoring & Logging

```bash
# View PM2 logs
pm2 logs

# Save logs
pm2 logs > app.log

# Monitor real-time
pm2 monit

# Setup log rotation
sudo apt-get install -y logrotate
```

### 5. Backup Regular

```bash
# Create backup script
cat > /home/username/backup_absensi.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/username/backups"
DB_NAME="absensi"
DB_USER="absensi_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/absensi_$TIMESTAMP.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
EOF

# Make executable
chmod +x /home/username/backup_absensi.sh

# Setup cron job (daily at 2 AM)
crontab -e
# Add line: 0 2 * * * /home/username/backup_absensi.sh
```

---

## 📝 Checklist Sebelum Go-Live

- [ ] Database sudah setup dan terisi data
- [ ] `.env` backend sudah dikonfigurasi dengan benar
- [ ] `.env.local` frontend sudah dibuat
- [ ] Backend running tanpa error (`pm2 status`)
- [ ] Frontend accessible dan tidak ada CORS error
- [ ] Login berhasil dan dashboard loading data
- [ ] Halaman pegawai menampilkan semua karyawan
- [ ] Halaman absensi menampilkan data attendance
- [ ] SSL/HTTPS sudah setup (di production)
- [ ] Firewall sudah dikonfigurasi
- [ ] Backup script sudah berjalan
- [ ] Monitoring sudah setup (optional)

---

## 🆘 Support & Debug

Jika ada error yang tidak bisa diselesaikan:

1. **Collect Logs:**
   ```bash
   pm2 logs api-absensi > backend.log
   pm2 logs frontend-absensi > frontend.log
   ```

2. **Check System Resources:**
   ```bash
   free -h  # RAM
   df -h    # Disk
   htop     # Process monitoring
   ```

3. **View Error Details:**
   - Browser Console (F12 → Console tab)
   - Browser Network tab (F12 → Network tab)
   - Backend logs (pm2 logs)

4. **Common Ports Being Used:**
   ```bash
   netstat -tuln | grep LISTEN
   ```

---

## 📚 Referensi Tambahan

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment/static-exports)
- [Nginx Reverse Proxy](https://nginx.org/en/docs/)
- [PM2 Process Manager](https://pm2.keymetrics.io/docs/)

