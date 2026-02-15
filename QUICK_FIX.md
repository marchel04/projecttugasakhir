# ⚡ QUICK FIX - IMMEDIATE ACTIONS (5 MENIT)

> 🔴 **JANGAN LEWAT INI!** Ini adalah 3 hal yang PALING PENTING untuk buat data muncul.

---

## ❗ MASALAH UTAMA

Data tidak muncul karena:
1. ❌ Backend tidak tahu URL frontend yang benar (CORS error)
2. ❌ Database tidak terhubung (DATABASE_URL masih localhost)
3. ❌ Frontend tidak tahu URL backend (NEXT_PUBLIC_API_URL tidak set)

---

## ✅ SOLUSI CEPAT (Harus dilakukan SEKARANG)

### 1️⃣ PERBAIKI `.env` BACKEND (5 menit)

📁 File: `api-absensi/.env`

**SEBELUM:**
```env
DATABASE_URL="mysql://root:@localhost:3306/absensi"
APP_ENV="development"
ORIGIN="http://localhost:3000"
```

**SESUDAH (update dengan info VPS Anda):**
```env
# Ganti localhost dengan IP/hostname database server Anda
DATABASE_URL="mysql://absensi_user:password@YOUR_DATABASE_IP:3306/absensi"

# Ubah ke production
APP_ENV="production"

# Ganti dengan IP/domain VPS Anda
ORIGIN="http://YOUR_VPS_IP:3000"
```

**Get your VPS IP:**
```bash
# Di terminal VPS, jalankan:
hostname -I
# Atau tanya kepada provider hosting Anda
```

---

### 2️⃣ BUAT FILE `.env.local` UNTUK FRONTEND (3 menit)

📁 File: `aplikasi-absensi-nextjs/.env.local` **[FILE BARU - PERLU DIBUAT]**

```env
NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP:4000
```

**Contoh:**
```env
# Jika VPS IP = 185.123.123.123
NEXT_PUBLIC_API_URL=http://185.123.123.123:4000
```

---

### 3️⃣ RESTART SEMUA SERVICES (2 menit)

```bash
# BACKEND
cd api-absensi
pm2 restart api-absensi
# atau:
npm start

# FRONTEND (di terminal lain)
cd aplikasi-absensi-nextjs
# Jika npm run build belum dilakukan:
npm run build

pm2 restart frontend-absensi
# atau:
npm start
```

---

## 🧪 TEST APAKAH SUDAH BERHASIL

### Buka browser ke VPS Anda:

```
http://YOUR_VPS_IP:3000
```

### Cek 3 hal ini:

1. **Login page muncul?**
   - ✅ YA → Lanjut ke step 2
   - ❌ TIDAK → Check terminal untuk error

2. **Login dengan credentials admin**
   - ✅ Berhasil login → Lanjut ke step 3
   - ❌ Error → Check F12 Console untuk CORS error

3. **Buka halaman "Pegawai"**
   - ✅ Data muncul → 🎉 BERHASIL!
   - ❌ Data kosong, buka F12 Console:
     - Jika ada CORS error → Kembali ke step 1️⃣
     - Jika ada 401/403 error → Pastikan sudah login
     - Jika halaman blank → Buka Network tab, cek API response

---

## 🔍 JIKA MASIH TIDAK BERHASIL

### Debug Checklist:

```bash
# 1. Cek backend berjalan
pm2 status
# Expected: api-absensi status "online"

# 2. Cek backend accessible
curl http://localhost:4000/api/pegawai
# Expected: error 401 (unauthorized), NOT "connection refused"

# 3. Cek database connection
mysql -u absensi_user -p -h localhost -e "SELECT 1;"
# Expected: return 1 (connected)

# 4. Lihat backend logs
pm2 logs api-absensi
# Look for error messages

# 5. Lihat frontend logs (browser F12)
# Console tab → Look for error messages
# Network tab → Check /api/pegawai call status
```

---

## 📝 INFORMASI YANG PERLU DIKUMPULKAN

Agar bisa fix lebih cepat, kumpulkan informasi ini:

- [ ] IP VPS Anda (contoh: 185.123.123.123)
- [ ] Hostname/Domain (jika ada)
- [ ] MySQL username dan password
- [ ] IP/hostname server database (jika terpisah dari backend)
- [ ] Output dari `pm2 status`
- [ ] Output dari `pm2 logs api-absensi` (10 baris terakhir)
- [ ] Screenshot browser F12 Console
- [ ] Screenshot browser Network tab

---

## 🎯 NEXT STEPS SETELAH FIX

Setelah 3 hal di atas berhasil:

1. Setup SSL/HTTPS (opsional tapi recommended)
2. Setup Nginx reverse proxy (opsional tapi recommended)
3. Configure backup database (PENTING!)
4. Setup monitoring (opsional)
5. Optimize performance (opsional)

→ Lihat file `DEPLOYMENT_GUIDE.md` untuk langkah-langkah lengkap

---

## 💡 TIPS

- **Jangan lupa commit .env ke git!** (File `.env` TIDAK boleh di-commit, ubah ke `.env.local` di frontend)
- **Gunakan strong password** untuk MySQL user
- **Restart services setelah edit .env** - perubahan tidak auto-reload
- **Check timezone** - pastikan VPS timezone sama dengan expected (Asia/Jakarta)

---

## 📞 MASIH STUCK?

Jika sudah mengikuti semua langkah di atas tapi masih tidak berhasil:

1. Share output dari command-command di "[Debug Checklist](#debug-checklist)" section
2. Share screenshot browser F12 (Console + Network tab)
3. Share logs dari `pm2 logs api-absensi`
4. Describe masalah dengan detail

Good luck! 🚀

