# 🔍 ANALISIS MASALAH HOSTING VPS - SISTEM ABSENSI

## 📋 RINGKASAN MASALAH
Anda melaporkan bahwa **beberapa data pegawai tidak terinput dan tampilan antarmuka kurang**, serta **data absensi pegawai tidak muncul saat pegawai absen tidak masuk**. Setelah analisis komprehensif, saya menemukan **5 masalah utama** yang perlu diperbaiki.

---

## 🚨 MASALAH KRITIS #1: CORS Configuration Tidak Sesuai dengan VPS

### Lokasi Masalah
📁 **Backend: [src/index.js](src/index.js#L28-L33)**

### Masalah
```javascript
const corsOptions = {
  origin:
    process.env.APP_ENV === "development"
      ? "http://localhost:3000"
      : process.env.ORIGIN, // production
  credentials: true,
};
```

#### Penyebab
- Dalam development, CORS hanya menerima `http://localhost:3000`
- Saat hosting di VPS dengan domain/IP berbeda (misal `http://185.xxx.xxx.xxx`), frontend TIDAK bisa komunikasi dengan backend
- API akan menolak request dari origin yang berbeda

#### Dampak
✗ Semua request dari frontend ditolak CORS error  
✗ Data tidak bisa dimuat (pegawai, absensi, dll)  
✗ Console browser menampilkan error: `Access to XMLHttpRequest blocked by CORS policy`

---

## 🚨 MASALAH KRITIS #2: DATABASE_URL Masih Pointing ke Localhost

### Lokasi Masalah
📁 **Backend: [.env](.env#L1)**

### Masalah  
```dotenv
DATABASE_URL="mysql://root:@localhost:3306/absensi"
```

#### Penyebab
- Database masih menggunakan `localhost:3306` (local machine)
- Saat backend berjalan di VPS lain, tidak bisa koneksi ke database lokal
- Jika database di VPS yang SAMA, perlu menggunakan IP/hostname yang benar

#### Dampak
✗ Backend tidak bisa terhubung ke database  
✗ Semua query database gagal  
✗ Tidak ada data yang bisa dimuat

---

## 🚨 MASALAH KRITIS #3: Next.js Belum Dikonfigurasi untuk VPS

### Lokasi Masalah
📁 **Frontend: Tidak ada variable `NEXT_PUBLIC_API_URL` yang di-set**

### Masalah
Next.js app Anda tidak memiliki file `.env.local` atau `.env.production` dengan variable:
```env
NEXT_PUBLIC_API_URL=http://your-vps-ip:4000
```

#### Penyebab
- Frontend masih menggunakan `undefined` atau hardcoded `http://localhost:4000`
- Tidak bisa terhubung ke backend API di VPS
- Semua API calls gagal

#### Dampak
✗ Frontend tidak bisa fetch data dari backend  
✗ Halaman pegawai kosong  
✗ Data absensi tidak muncul

---

## 🚨 MASALAH CRITICAL #4: Endpoint `/api/absensi/gabungan` Memerlukan Auth + Admin Role

### Lokasi Masalah
📁 **Backend Route: [src/routes/absensi.router.js](src/routes/absensi.router.js#L33)**

```javascript
absensiRouter.get("/gabungan", protectAuth, isAdmin, getAllAbsensiDanIzin);
```

### Masalah
- Endpoint ini memerlukan **KEDUA middleware**: `protectAuth` (autentikasi) DAN `isAdmin` (role check)
- Jika user TIDAK ada token, atau token SALAH, atau user BUKAN admin → request DITOLAK

#### Penyebab
- Authentication token tidak valid di request
- User yang login BUKAN role admin
- Cookies tidak dikirim dengan benar saat fetch (CORS credentials issue)

#### Dampak
✗ Data absensi admin view tidak muncul  
✗ Halaman "Data Absen Pegawai" menampilkan empty table  
✗ Error 401/403 di console

---

## ⚠️ MASALAH PENTING #5: Pegawai Tidak Terinput Data

### Lokasi Masalah
📁 **Frontend: [app/(admin)/pegawai/PegawaiClient.jsx](app/(admin)/pegawai/PegawaiClient.jsx#L97-L120)**

### Masalah
Halaman pegawai menggunakan endpoint:
```javascript
const res = await fetch("/api/pegawai");
```

#### Kemungkinan Penyebab
1. **CORS Error** (dari masalah #1) → data tidak dimuat
2. **API Response Kosong** → database tidak terisi data pegawai
3. **API Gateway Issue** → reverse proxy tidak dikonfigurasi dengan benar

---

## ✅ SOLUSI LENGKAP

### STEP 1: Perbaiki File .env Backend

📁 **File: [.env](.env)**

Ubah dari:
```dotenv
DATABASE_URL="mysql://root:@localhost:3306/absensi"
JWT_SECRET="your_secret_key_here"
APP_ENV="development"
PORT=4000
ORIGIN="http://localhost:3000"
```

Menjadi (untuk VPS):
```dotenv
# Database Configuration
DATABASE_URL="mysql://username:password@DATABASE_HOST:3306/absensi"
# atau jika database di machine yang sama:
# DATABASE_URL="mysql://username:password@127.0.0.1:3306/absensi"

# Security
JWT_SECRET="use-a-strong-random-key-here-minimum-32-chars"

# Environment
APP_ENV="production"
PORT=4000

# Frontend URL (Sesuaikan dengan VPS URL Anda)
ORIGIN="http://185.xxx.xxx.xxx:3000"
# atau jika punya domain:
# ORIGIN="https://yourdomain.com"
```

**⚠️ PENTING:**
- Ganti `username` dan `password` dengan credentials MySQL Anda
- Ganti `DATABASE_HOST` dengan IP/hostname server database
- Ganti `185.xxx.xxx.xxx` dengan IP VPS Anda yang sebenarnya

---

### STEP 2: Buat File `.env.local` untuk Next.js

📁 **File Baru: `aplikasi-absensi-nextjs/.env.local`**

```env
# API Configuration untuk VPS
NEXT_PUBLIC_API_URL=http://185.xxx.xxx.xxx:4000
# atau jika punya domain:
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

**⚠️ PENTING:**
- Ganti `185.xxx.xxx.xxx` dengan IP VPS Anda
- Jangan tambahkan `/api` di akhir - backend sudah memiliki `/api/` di routenya

---

### STEP 3: Update CORS di Backend (Opsional - Untuk Development)

Jika ingin lebih fleksibel, edit [src/index.js](src/index.js#L28-L39):

```javascript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://185.xxx.xxx.xxx:3000",
      "https://yourdomain.com",
      // Tambahkan origin lain sesuai kebutuhan
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  credentials: true,
  optionsSuccessStatus: 204,
};
```

---

### STEP 4: Pastikan Database Sudah Terisi Data Pegawai

Jalankan query di MySQL Anda:

```sql
-- Cek apakah table pegawai ada dan berisi data
SELECT COUNT(*) as total_pegawai FROM pegawai;
SELECT * FROM pegawai LIMIT 5;

-- Jika kosong, jalankan seed (jika ada)
-- Atau tambahkan data pegawai secara manual
```

Jika table kosong, Anda perlu seed data terlebih dahulu. Lihat [prisma/seed.js](../api-absensi/prisma/seed.js).

---

### STEP 5: Rebuild dan Redeploy

#### Backend (Node.js):
```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate deploy
npx prisma db seed  # jika seed ada

# Start server
npm start
# atau gunakan PM2:
pm2 start src/index.js --name "api-absensi"
```

#### Frontend (Next.js):
```bash
# Install dependencies  
npm install

# Rebuild dengan env baru
npm run build

# Start production server
npm start
# atau gunakan PM2:
pm2 start npm --name "frontend-absensi" -- start
```

---

## 🔍 TESTING CHECKLIST

Setelah deployment, cek hal-hal berikut:

### ✓ Test 1: API Connectivity
```bash
# Dari VPS atau mesin lokal, test backend API:
curl http://185.xxx.xxx.xxx:4000/api/pegawai
# Harusnya return error 401 jika belum login, tapi endpoint accessible
```

### ✓ Test 2: Database Connection
```bash
# Di backend, cek logs:
npm start
# Lihat apakah ada error database connection
```

### ✓ Test 3: Frontend Loads Data
1. Buka browser → http://185.xxx.xxx.xxx:3000
2. Login sebagai admin
3. Pergi ke halaman "Pegawai"
4. Buka DevTools (F12) → Network tab
5. Cek apakah GET `/api/pegawai` return 200 dan berisi data
6. Cek Console untuk error CORS

### ✓ Test 4: Absence Data Shows
1. Login sebagai admin
2. Pergi ke halaman "Data Absen Pegawai"
3. Buka DevTools → Network tab
4. Cek apakah GET `/api/absensi/gabungan` return 200
5. Lihat apakah ada data pegawai yang belum absen tampil

---

## 📊 Tabel Ringkasan Masalah & Solusi

| Masalah | Penyebab | Solusi |
|---------|---------|--------|
| Halaman pegawai kosong | CORS error / API unreachable | Update `.env` ORIGIN & CORS settings |
| Data tidak muncul | Database URL salah | Fix DATABASE_URL di `.env` |
| Frontend tidak connect ke API | NEXT_PUBLIC_API_URL tidak set | Buat `.env.local` di Next.js folder |
| Absence data tidak muncul | Auth middleware fail / Query kosong | Check authentication & add test data |
| Interface kurang sempurna | Kemungkinan data dependency | Pastikan semua table (pegawai, jam_kerja, divisi) terisi |

---

## 🎯 LANGKAH SELANJUTNYA

1. **IMMEDIATELY**: Update `.env` backend dengan config VPS yang benar
2. **IMMEDIATELY**: Buat `.env.local` untuk Next.js
3. **Check**: Database sudah terkoneksi & terisi data
4. **Test**: Semua endpoint accessible & return data
5. **Monitor**: Check logs untuk error messages
6. **Optimize**: Setup reverse proxy (Nginx) untuk production

---

## 📞 DEBUG COMMANDS

Jika masih ada error, jalankan:

```bash
# Debug backend
curl -v http://185.xxx.xxx.xxx:4000/api/pegawai

# Check database
mysql -h 185.xxx.xxx.xxx -u username -p -e "SELECT COUNT(*) FROM absensi.pegawai;"

# Check frontend logs
# Di browser: F12 → Console & Network tab

# Check server logs (jika menggunakan PM2)
pm2 logs api-absensi
pm2 logs frontend-absensi
```

