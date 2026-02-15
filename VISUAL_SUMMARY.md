# 🎯 VISUAL SUMMARY - Masalah & Solusi

## Masalah #1: CORS Error (Data Pegawai & Absensi tidak muncul)

```
Frontend                Backend              Database
(VPS IP 185.x.x.x)     (VPS IP 185.x.x.x)
:3000                  :4000

Browser request:           ❌ BLOCKED
GET /api/pegawai       ────[CORS ERROR]───→ Backend
                           
Reason: 
  Origin: http://185.x.x.x:3000
  vs
  Allowed: http://localhost:3000  ← masalah di sini!

Solution: Update .env
  ORIGIN="http://185.x.x.x:3000"
```

---

## Masalah #2: Database Connection Error (Backend error)

```
Backend
:4000

┌────────────────────┐
│   EXPRESS APP      │
└────────┬───────────┘
         │
         │ connect
         │ DATABASE_URL
         │ = mysql://root:@localhost
         ↓ ❌ Connection Refused!
         
┌────────────────────┐
│   MySQL Server     │ (not accessible from VPS)
│   localhost:3306   │
└────────────────────┘

Solution: Update .env
  DATABASE_URL="mysql://user:pass@ACTUAL_DB_IP:3306/absensi"
```

---

## Masalah #3: Missing Environment Variable (Frontend error)

```
Frontend (.env.local)

┌──────────────────────────────────┐
│   NextJS App                     │
│   :3000                          │
│                                  │
│   NEXT_PUBLIC_API_URL = ???      │ ← Undefined!
│   (fetch /api/pegawai)     │
└──────────────────────────────────┘
         │
         ↓ Where to fetch?
         
❌ Cannot reach API

Solution: Create .env.local
  NEXT_PUBLIC_API_URL="http://185.x.x.x:4000"
```

---

## Solusi Lengkap (Setelah Fix)

```
┌─────────────────────────────────────────────────────────────────┐
│                       User Browser                              │
│              http://185.x.x.x:3000                             │
│  ┌────────────────────────────────────────────┐                │
│  │  NextJS Frontend                           │                │
│  │  .env.local: NEXT_PUBLIC_API_URL=...✅       │                │
│  └────────────┬─────────────────────────────┘                │
└─────────────┼─────────────────────────────────────────────────┘
              │
              │ Fetch /api/pegawai 
              │ (✅ CORS OK - Origin matches)
              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Express Backend (Port 4000)                        │
│  .env: ORIGIN="http://185.x.x.x:3000"✅                       │
│  .env: DATABASE_URL="mysql://user:pass@DB_IP:3306/absensi"✅   │
│                                                                 │
│  Routes:                                                        │
│  GET /api/pegawai          → Query → DB pegawai table          │
│  GET /api/absensi/gabungan → Query → DB absensi + pegawai      │
│                                                                 │
│  ┌────────────────────────┐                                    │
│  │ PRISMA ORM             │                                    │
│  └────────────┬───────────┘                                    │
└──────────────┼──────────────────────────────────────────────────┘
               │
               │ ✅ Connected
               ↓
┌─────────────────────────────────────────────────────────────────┐
│              MySQL Database (Port 3306)                         │
│  Database: absensi                                              │
│                                                                 │
│  Tables:                                                        │
│  ├─ pegawai    (id, nip, nama, ...)  ← Displayed in app       │
│  ├─ absensi    (id, id_pegawai, ...)  ← Displayed in app      │
│  ├─ izin       (...)                                           │
│  └─ jam_kerja  (...)                                           │
└─────────────────────────────────────────────────────────────────┘

Result: ✅ All data loaded successfully!
```

---

## Checklist Fixes (Priority Order)

### 🔴 MUST DO (Critical)
```
[ ] 1. Update api-absensi/.env
       └─ DATABASE_URL → Correct DB connection
       └─ ORIGIN → Your VPS URL
       └─ APP_ENV → "production"

[ ] 2. Create aplikasi-absensi-nextjs/.env.local
       └─ NEXT_PUBLIC_API_URL → Your backend URL

[ ] 3. Restart Services
       └─ pm2 restart all
       └─ Test in browser
```

### 🟡 SHOULD DO (High Priority)
```
[ ] 4. Setup SSL/HTTPS
[ ] 5. Setup Nginx Reverse Proxy
[ ] 6. Configure Firewall
[ ] 7. Setup Database Backup
```

### 🟢 NICE TO DO (Optional)
```
[ ] 8. Setup Monitoring (PM2+)
[ ] 9. Setup Logging
[ ] 10. Performance tuning
```

---

## 📝 What to Update

### File 1: api-absensi/.env

**BEFORE:**
```env
DATABASE_URL="mysql://root:@localhost:3306/absensi"
ORIGIN="http://localhost:3000"
```

**AFTER:**
```env
DATABASE_URL="mysql://user:password@185.x.x.x:3306/absensi"
ORIGIN="http://185.x.x.x:3000"
```

### File 2: aplikasi-absensi-nextjs/.env.local (NEW FILE)

```env
NEXT_PUBLIC_API_URL=http://185.x.x.x:4000
```

---

## 🧪 Test After Fix

### Step 1: Test Backend
```bash
$ curl http://185.x.x.x:4000/api/pegawai
Expected: 
  {
    "success": false,
    "message": "Unauthorized"
  }
  (Status 401 is OK - means endpoint is accessible)
  
NOT Expected:
  Connection refused
  Socket hang up
  (These mean backend not running or unreachable)
```

### Step 2: Test Frontend in Browser
```
1. Open: http://185.x.x.x:3000
2. Login with admin credentials
3. Go to "Pegawai" page
4. Expected: See list of employees
5. Open F12 Console: No CORS errors
```

### Step 3: Test Data Loading
```
1. Go to "Data Absen Pegawai" page
2. Expected: See absence data or "Belum Absen" entries
3. Open Network tab (F12): All API calls return 200
```

---

## 🚨 Common Errors & Quick Fixes

### Error: CORS Policy Blocked
```
Access to XMLHttpRequest at 'http://...' from origin 'http://...' 
has been blocked by CORS policy
```
**Fix:** Update ORIGIN in .env, restart backend

### Error: Connection Refused to Database
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Fix:** Update DATABASE_URL in .env, check MySQL running

### Error: Cannot Find Module (after env change)
```
TypeError: Cannot read property 'xxx' of undefined
```
**Fix:** Rebuild Next.js: `npm run build`

### Error: 401 Unauthorized
```
HTTP 401 - Unauthorized
```
**Fix:** Login first, check JWT token in cookies

---

## 📊 Summary Table

| Component | Status | Issue | Fix |
|-----------|--------|-------|-----|
| Backend Code | ✅ OK | CORS config | Update `.env` |
| Frontend Code | ✅ OK | Missing env var | Create `.env.local` |
| Database Schema | ✅ OK | Connection string | Update `DATABASE_URL` |
| Data | ❓ Unclear | Maybe empty | Check DB / seed data |
| Deployment | ❌ NOT DONE | Config missing | Follow DEPLOYMENT_GUIDE.md |

---

## 🎯 Expected Outcome After Fix

### Before Fix ❌
```
Browser → Frontend loads ✅
Frontend → API call BLOCKED ❌
        CORS Error ❌
Backend → Cannot connect to DB ❌
Result: Empty pages, error messages
```

### After Fix ✅
```
Browser → Frontend loads ✅
Frontend → API call succeeds ✅
        Data JSON response ✅
Backend → Connected to DB ✅
        Queries execute ✅
Result: All data displays properly 🎉
```

---

Need help? 📞
- Read: QUICK_FIX.md (5 min overview)
- Read: ANALISIS_MASALAH_VPS.md (detailed analysis)
- Read: DEPLOYMENT_GUIDE.md (complete setup)

