const dayjs = require("dayjs");
const { checkTerlambat, checkPulangCepat } = require("../utils/cekStatusAbsen.js");
const prisma = require("../utils/prisma.js");
const {
  calculateLatenessMinutes,
  calculateWorkHours,
  getWorkSchedule,
  isExceedsDeadline,
  checkIfAlreadyCheckedInToday,
  checkIfAlreadyHasLeaveToday,
} = require("../utils/absenceCalculations.js");

const TZ = "Asia/Jakarta";

const AbsensiService = {
  getAllAbsensiService: async function () {
    return await prisma.absensi.findMany({
      orderBy: { id_pegawai: "asc" },
      include: { pegawai: true },
    });
  },

  getAbsensiServiceById: async function (id) {
    return await prisma.absensi.findUnique({
      where: { id_absensi: Number(id) },
      include: { pegawai: true },
    });
  },

  getAbsensiByPegawaiService: async function (id_pegawai) {
    // Return combined absensi + izin entries so admin view shows izin in riwayat
    const absensi = await prisma.absensi.findMany({
      where: { id_pegawai: Number(id_pegawai) },
      include: { pegawai: true, jamKerja: true },
      orderBy: { tgl_absensi: "desc" },
    });

    // include all izin statuses so pending izin also appears
    const izin = await prisma.izin.findMany({
      where: { id_pegawai: Number(id_pegawai) },
      orderBy: { tgl_mulai: "desc" },
    });

    const gabungan = [];

    absensi.forEach(item => {
      gabungan.push({
        type: 'absensi',
        id_absensi: item.id_absensi,
        pegawai: item.pegawai,
        tgl_absensi: item.tgl_absensi,
        tanggal: item.tgl_absensi,
        jam_masuk: item.jam_masuk,
        jam_pulang: item.jam_pulang,
        status: item.status,
        status_pulang: item.status_pulang,
        jam_terlambat: item.jam_terlambat,
        total_jam_kerja: item.total_jam_kerja,
        data: item,
      });
    });

    izin.forEach(item => {
      const start = new Date(item.tgl_mulai);
      const end = new Date(item.tgl_selesai);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        gabungan.push({
          type: 'izin',
          id_izin: item.id_izin,
          pegawai: null, // pegawai info not necessary here; controller can attach if needed
          tgl_absensi: new Date(d),
          tanggal: new Date(d),
          jam_masuk: null,
          jam_pulang: null,
          status: item.alasan || 'Izin',
          jam_terlambat: 0,
          total_jam_kerja: null,
          data: item,
        });
      }
    });

    gabungan.sort((a, b) => new Date(b.tgl_absensi) - new Date(a.tgl_absensi));

    return gabungan;
  },

  getAbsensiByPegawaiWithDateRangeService: async function (id_pegawai, tanggal_awal, tanggal_akhir) {
    const startDate = dayjs(tanggal_awal).tz(TZ).startOf("day").utc().toDate();
    const endDate = dayjs(tanggal_akhir).tz(TZ).endOf("day").utc().toDate();

    return await prisma.absensi.findMany({
      where: {
        id_pegawai: Number(id_pegawai),
        tgl_absensi: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        pegawai: true,
      },
      orderBy: {
        tgl_absensi: "desc",
      },
    });
  },

  getTodayAbsensiService: async function (id) {
    const startDay = dayjs().tz(TZ).startOf("day").utc().toDate();
    const endDay = dayjs().tz(TZ).endOf("day").utc().toDate();

    return await prisma.absensi.findFirst({
      where: {
        id_pegawai: Number(id),
        tgl_absensi: {
          gte: startDay,
          lt: endDay,
        },
      },
      include: { pegawai: true, jamKerja: true },
    });
  },

  getAllAbsensiTerlambatService: async function () {
    return await prisma.absensi.findMany({
      where: {
        status: "terlambat",
      },
      include: { pegawai: true },
    });
  },

  getTodayAllAbsensiService: async function () {
    const startDay = dayjs().tz(TZ).startOf("day").utc().toDate();
    const endDay = dayjs().tz(TZ).endOf("day").utc().toDate();

    return await prisma.absensi.findMany({
      where: {
        tgl_absensi: {
          gte: startDay,
          lt: endDay,
        },
      },
      distinct: ["id_pegawai"],
      include: { pegawai: true },
    });
  },

  getTodayTerlambatService: async function () {
    const startDay = dayjs().tz(TZ).startOf("day").utc().toDate();
    const endDay = dayjs().tz(TZ).endOf("day").utc().toDate();

    return await prisma.absensi.findMany({
      where: {
        tgl_absensi: {
          gte: startDay,
          lte: endDay,
        },
        OR: [
          { status: "terlambat" },
          { status_pulang: "pulang_cepat" },
          { jam_terlambat: { gt: 0 } },
        ],
      },
      include: { pegawai: true },
    });
  },

  createAbsensiService: async function (data) {
    if (!data.user?.id_pegawai) {
      throw new Error("ID Pegawai tidak ditemukan dari user login");
    }

    const id_pegawai = data.user.id_pegawai;
    
    // Parse jam_masuk dari ISO datetime string ke dayjs dengan timezone TZ
    let jamMasukTime;
    try {
      // data.jam_masuk bisa berupa ISO string (dari frontend) atau string lain
      jamMasukTime = dayjs(data.jam_masuk).tz(TZ);
      
      if (!jamMasukTime.isValid()) {
        throw new Error("Format jam_masuk tidak valid");
      }
      
      console.log(`[DEBUG] Raw jam_masuk: ${data.jam_masuk}`);
      console.log(`[DEBUG] Parsed jamMasukTime (${TZ}): ${jamMasukTime.format("YYYY-MM-DD HH:mm:ss Z")}`);
    } catch (err) {
      throw new Error(`Gagal parse jam_masuk: ${err.message}`);
    }

    // === VALIDASI 1: Cek apakah sudah ada absensi hari ini ===
    const alreadyCheckedIn = await checkIfAlreadyCheckedInToday(
      id_pegawai,
      jamMasukTime.toDate(),
      prisma
    );

    if (alreadyCheckedIn) {
      throw new Error("Anda sudah melakukan presensi hari ini");
    }

    // === VALIDASI 2: Cek apakah sudah ada izin yang disetujui hari ini ===
    const hasApprovedLeave = await checkIfAlreadyHasLeaveToday(
      id_pegawai,
      jamMasukTime.toDate(),
      prisma
    );

    if (hasApprovedLeave) {
      throw new Error("Anda sudah memiliki izin yang disetujui hari ini");
    }

    // Ambil data pegawai terlebih dahulu
    const pegawai = await prisma.pegawai.findUnique({
      where: { id_pegawai },
    });

    if (!pegawai) {
      throw new Error("Pegawai tidak ditemukan");
    }

    // Ambil jam kerja berdasarkan pengaturan pegawai (jika ada),
    // jika tidak ada gunakan jam kerja default pertama.
    let jamKerja;
    if (pegawai.id_jam) {
      jamKerja = await prisma.jamKerja.findUnique({
        where: { id_jam: Number(pegawai.id_jam) },
      });
    } else {
      jamKerja = await prisma.jamKerja.findFirst();
    }

    if (!jamKerja) {
      throw new Error("Jam kerja tidak ditemukan");
    }

    // Dapatkan jadwal kerja (custom atau default)
    const schedule = getWorkSchedule(pegawai, jamKerja);

    // === VALIDASI 3: Tentukan apakah terlambat berdasarkan batas toleransi ===
    // Catatan: sekarang pegawai tetap boleh melakukan absen setelah batas toleransi,
    // namun status akan ditandai sebagai "terlambat".
    const jamMasukActual = jamMasukTime.format("HH:mm");
    
    console.log(`[DEBUG SCHEDULE] Schedule jam_masuk: ${schedule.jam_masuk}, Actual HH:mm: ${jamMasukActual}`);

    // Cek apakah waktu absensi sudah mencapai jam masuk yang ditetapkan oleh admin
    if (schedule.jam_masuk) {
      const [h, m] = schedule.jam_masuk.split(":").map(Number);
      const scheduledStart = dayjs(jamMasukTime)
        .tz(TZ)
        .hour(h)
        .minute(m)
        .second(0);

      if (jamMasukTime.isBefore(scheduledStart)) {
        throw new Error(
          `Belum waktunya absen. Absen mulai pada jam ${schedule.jam_masuk}`
        );
      }
    }

    // Hitung jam terlambat dari batas_masuk yang dijadwalkan (bukan dari jam_masuk)
    // Jam terlambat hanya dihitung jika melewati batas_masuk
    // Contoh: jam_masuk=11:50, batas_masuk=11:56, absen 11:51 -> jam_terlambat = 0 menit (belum lewat batas)
    // Contoh: jam_masuk=11:50, batas_masuk=11:56, absen 11:57 -> jam_terlambat = 1 menit (1 menit setelah batas)
    let latenessMinutes = 0;
    if (schedule.batas_masuk) {
      latenessMinutes = calculateLatenessMinutes(
        schedule.batas_masuk,
        jamMasukTime.toDate()
      );
    }

    // DEBUG: Log untuk verifikasi perhitungan
    console.log(`[DEBUG LATENESS RESULT] Batas masuk: ${schedule.batas_masuk}, Actual: ${jamMasukActual}, Lateness: ${latenessMinutes} minutes`);

    // Hitung total jam kerja (asumsi belum ada jam pulang)
    const workHours = calculateWorkHours(
      schedule.jam_masuk,
      schedule.jam_pulang,
      latenessMinutes
    );

    // Tentukan status: status = 'terlambat' jika melewati batas_masuk
    let status;
    if (schedule.batas_masuk) {
      status = isExceedsDeadline(jamMasukActual, schedule.batas_masuk)
        ? "terlambat"
        : "hadir";
    } else {
      status = latenessMinutes > 0 ? "terlambat" : "hadir";
    }

    console.log(`[DEBUG STATUS] Status: ${status}, Batas masuk: ${schedule.batas_masuk}, Actual: ${jamMasukActual}, Lateness: ${latenessMinutes} minutes`);

    return await prisma.absensi.create({
      data: {
        tgl_absensi: jamMasukTime.toDate(),
        jam_masuk: jamMasukTime.toDate(),
        status,
        id_pegawai,
        id_jam: jamKerja.id_jam,
        jam_terlambat: Math.round(latenessMinutes),
        total_jam_kerja: workHours,
        sudah_izin_hari_ini: hasApprovedLeave,
      },
      include: { pegawai: true, jamKerja: true },
    });
  },

  updateAbsensiService: async function (id_pegawai, data) {
    const startDay = dayjs().tz(TZ).startOf("day").utc().toDate();
    const endDay = dayjs().tz(TZ).endOf("day").utc().toDate();

    const absensi = await prisma.absensi.findFirst({
      where: {
        id_pegawai: Number(id_pegawai),
        tgl_absensi: {
          gte: startDay,
          lte: endDay,
        },
      },
      include: { pegawai: true, jamKerja: true },
    });

    if (!absensi) {
      throw new Error("Belum absen masuk hari ini");
    }

    const { pulangCepat } = await checkPulangCepat(
      id_pegawai,
      data.jam_pulang
    );

    const jamPulangTime = dayjs(data.jam_pulang).tz(TZ);
    const jamMasukTime = dayjs(absensi.jam_masuk).tz(TZ);

    // Allow pegawai to absen pulang anytime without time deadline restriction

    // Hitung total jam kerja dengan presisi detik (jangan hanya menit)
    const durationSeconds = jamPulangTime.diff(jamMasukTime, "second");
    const actualWorkSeconds = Math.max(0, durationSeconds - (absensi.jam_terlambat || 0) * 60);
    const totalJamKerja = parseFloat((actualWorkSeconds / 3600).toFixed(4));

    return await prisma.absensi.update({
      where: { id_absensi: absensi.id_absensi },
      data: {
        jam_pulang: jamPulangTime.toDate(),
        status_pulang: pulangCepat ? "pulang_cepat" : absensi.status,
        total_jam_kerja: totalJamKerja,
      },
      include: { pegawai: true, jamKerja: true },
    });
  },

  deleteAbsensiService: async function (id) {
    return await prisma.absensi.delete({
      where: { id_absensi: Number(id) },
    });
  },

  getAbsensiDanIzinByPegawaiService: async function (id_pegawai) {
    // Ambil data absensi
    const absensi = await prisma.absensi.findMany({
      where: {
        id_pegawai: Number(id_pegawai),
      },
      orderBy: {
        tgl_absensi: "desc",
      },
    });

    // Fetch pegawai info
    const pegawai = await prisma.pegawai.findUnique({
      where: { id_pegawai: Number(id_pegawai) },
    });

    // Ambil data izin (semua status) untuk menampilkan riwayat pegawai termasuk izin pending
    const izin = await prisma.izin.findMany({
      where: {
        id_pegawai: Number(id_pegawai),
      },
      orderBy: { tgl_mulai: 'desc' },
    });

    // Ambil default JamKerja untuk perhitungan izin
    const defaultJamKerja = await prisma.jamKerja.findFirst();

    // Helper function untuk hitung menit
    const calculateMinutesBetween = (jamMasuk, batasMasuk) => {
      if (!jamMasuk || !batasMasuk) return 0;
      try {
        const jm = dayjs(`2000-01-01 ${jamMasuk}`, 'YYYY-MM-DD HH:mm');
        const bm = dayjs(`2000-01-01 ${batasMasuk}`, 'YYYY-MM-DD HH:mm');
        const minutes = Math.max(0, bm.diff(jm, 'minute'));
        return minutes / 60; // konversi ke jam (decimal)
      } catch (e) {
        return 0;
      }
    };

    // Helper untuk calculate work hours dari jam_masuk/jam_pulang
    const calculateWorkHoursFromTimes = (jamMasuk, jamPulang, jamTerlambat = 0) => {
      if (!jamMasuk || !jamPulang) return 0;
      try {
        const masuk = dayjs(jamMasuk);
        const pulang = dayjs(jamPulang);
        const totalSeconds = Math.max(0, pulang.diff(masuk, 'second'));
        // jam_terlambat is just a flag/indicator, not subtracted from work hours
        // Use 4 decimal precision to match getAllAbsensiDanIzinService
        return parseFloat((totalSeconds / 3600).toFixed(4));
      } catch (e) {
        return 0;
      }
    };

    // Gabungkan data - buat entry untuk setiap hari izin
    const gabungan = [];

    // Tambah data absensi
    absensi.forEach(item => {
      // Hitung total jam kerja
      let totalJamKerja = 0;
      
      // Convert total_jam_kerja from DB (might be Decimal)
      let dbTotalJamKerja = 0;
      if (item.total_jam_kerja) {
        if (typeof item.total_jam_kerja === 'number') {
          dbTotalJamKerja = item.total_jam_kerja;
        } else if (typeof item.total_jam_kerja === 'string') {
          dbTotalJamKerja = parseFloat(item.total_jam_kerja);
        } else if (item.total_jam_kerja && typeof item.total_jam_kerja === 'object') {
          // Prisma Decimal type
          dbTotalJamKerja = parseFloat(item.total_jam_kerja.toString());
        }
      }
      
      // Jika sudah ada jam pulang, hitung dari selisih jam masuk dan jam pulang aktual
      if (item.jam_masuk && item.jam_pulang) {
        totalJamKerja = calculateWorkHoursFromTimes(item.jam_masuk, item.jam_pulang, item.jam_terlambat || 0);
      } else if (dbTotalJamKerja > 0) {
        // Jika belum ada jam pulang, gunakan nilai dari database jika ada
        totalJamKerja = dbTotalJamKerja;
      }
      // Jika hanya ada jam_masuk (belum pulang dan tidak ada nilai di DB), totalJamKerja tetap 0
      
      gabungan.push({
        type: "absensi",
        tanggal: item.tgl_absensi,
        jam_masuk: item.jam_masuk,
        jam_pulang: item.jam_pulang,
        status: item.status,
        jam_terlambat: item.jam_terlambat,
        status_pulang: item.status_pulang,
        total_jam_kerja: totalJamKerja,
        data: item,
      });
    });

    // Tambah data izin (untuk setiap hari dalam range izin)
    izin.forEach(item => {
      const start = new Date(item.tgl_mulai);
      const end = new Date(item.tgl_selesai);
      
      // Hitung total jam kerja untuk izin berdasarkan bounded minutes
      let totalJamKerjaIzin = 0;
      if (defaultJamKerja) {
        const jamMasuk = pegawai?.jam_masuk_custom || defaultJamKerja.jam_masuk;
        const batasMasuk = defaultJamKerja.batas_masuk;
        totalJamKerjaIzin = calculateMinutesBetween(jamMasuk, batasMasuk);
      }
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        gabungan.push({
          type: "izin",
          tanggal: new Date(d),
          keterangan: item.keterangan,
          jenis_izin: item.jenis_izin,
          total_jam_kerja: totalJamKerjaIzin,
          data: item,
        });
      }
    });

    // Sort berdasarkan tanggal (terbaru terlebih dahulu)
    gabungan.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return gabungan;
  },

  // -------- GET ALL ABSENSI + IZIN (ADMIN VIEW) --------
  getAllAbsensiDanIzinService: async function (opts = {}) {
    // opts can include tanggal_awal, tanggal_akhir to filter range
    let filterDate = dayjs().tz(TZ).startOf('day').toDate(); // default: hari ini
    if (opts.tanggal_awal && opts.tanggal_akhir) {
      // Jika ada range, gunakan untuk query; tapi untuk pegawai "belum absen", gunakan hari ini
      const startDate = dayjs(opts.tanggal_awal).tz(TZ).startOf('day').utc().toDate();
      const endDate = dayjs(opts.tanggal_akhir).tz(TZ).endOf('day').utc().toDate();
      var whereAbsensi = { tgl_absensi: { gte: startDate, lte: endDate } };
    } else {
      const startDay = dayjs().tz(TZ).startOf('day').utc().toDate();
      const endDay = dayjs().tz(TZ).endOf('day').utc().toDate();
      var whereAbsensi = { tgl_absensi: { gte: startDay, lte: endDay } };
    }

    // Ambil semua absensi
    const absensi = await prisma.absensi.findMany({
      where: whereAbsensi,
      orderBy: { tgl_absensi: 'desc' },
      include: { pegawai: true },
    });

    // Ambil semua izin yang overlap
    const izinWhere = { status_izin: 'disetujui' };
    if (opts.tanggal_awal && opts.tanggal_akhir) {
      const monthStart = dayjs(opts.tanggal_awal).tz(TZ).startOf('day').utc().toDate();
      const monthEnd = dayjs(opts.tanggal_akhir).tz(TZ).endOf('day').utc().toDate();
      izinWhere.tgl_mulai = { lte: monthEnd };
      izinWhere.tgl_selesai = { gte: monthStart };
    } else {
      // Jika tidak ada range, ambil izin hari ini saja
      const today = dayjs().tz(TZ).startOf('day').toDate();
      const tomorrow = dayjs().tz(TZ).endOf('day').toDate();
      izinWhere.tgl_mulai = { lte: tomorrow };
      izinWhere.tgl_selesai = { gte: today };
    }

    const izin = await prisma.izin.findMany({
      where: izinWhere,
      include: { pegawai: true },
    });

    // Ambil default/first JamKerja untuk perhitungan izin
    const defaultJamKerja = await prisma.jamKerja.findFirst();

    // Ambil semua pegawai (kecuali admin) untuk hari ini jika tidak ada range
    let allPegawai = [];
    if (!opts.tanggal_awal && !opts.tanggal_akhir) {
      allPegawai = await prisma.pegawai.findMany({
        where: { NOT: { role: 'admin' } },
      });
    }

    const gabungan = [];
    const processedPegawaiIds = new Set();

    // Helper function untuk hitung menit dari dua time string (HH:mm)
    const calculateMinutesBetween = (jamMasuk, batasMasuk) => {
      if (!jamMasuk || !batasMasuk) return 0;
      try {
        const jm = dayjs(`2000-01-01 ${jamMasuk}`, 'YYYY-MM-DD HH:mm');
        const bm = dayjs(`2000-01-01 ${batasMasuk}`, 'YYYY-MM-DD HH:mm');
        const minutes = Math.max(0, bm.diff(jm, 'minute'));
        return minutes / 60; // konversi ke jam (decimal)
      } catch (e) {
        return 0;
      }
    };

    // 1. Proses absensi
    absensi.forEach(item => {
      processedPegawaiIds.add(item.id_pegawai);
      
      // Hitung total jam kerja untuk absensi
      let totalJamKerjaAbsensi = 0;
      
      // Convert total_jam_kerja from DB (might be Decimal)
      let dbTotalJamKerja = 0;
      if (item.total_jam_kerja) {
        if (typeof item.total_jam_kerja === 'number') {
          dbTotalJamKerja = item.total_jam_kerja;
        } else if (typeof item.total_jam_kerja === 'string') {
          dbTotalJamKerja = parseFloat(item.total_jam_kerja);
        } else if (item.total_jam_kerja && typeof item.total_jam_kerja === 'object') {
          // Prisma Decimal type
          dbTotalJamKerja = parseFloat(item.total_jam_kerja.toString());
        }
      }
      
      // Jika sudah ada jam pulang, hitung dari selisih jam masuk dan jam pulang aktual
      if (item.jam_masuk && item.jam_pulang) {
        try {
          const jamMasukTime = dayjs(item.jam_masuk);
          const jamPulangTime = dayjs(item.jam_pulang);
          
          if (!jamMasukTime.isValid() || !jamPulangTime.isValid()) {
            throw new Error('Invalid datetime');
          }
          
          // Hitung selisih dari jam masuk ke jam pulang (tanpa kurangi lateness)
          // jam_terlambat adalah penalty flag, bukan durasi yang dikurangi dari work hours
          const durationSeconds = jamPulangTime.diff(jamMasukTime, "second");
          totalJamKerjaAbsensi = parseFloat((durationSeconds / 3600).toFixed(4));

          // If computed duration is zero but DB has a stored non-zero value (e.g., "00:00:13"), prefer DB value
          if ((isNaN(totalJamKerjaAbsensi) || totalJamKerjaAbsensi < 0) && dbTotalJamKerja) {
            totalJamKerjaAbsensi = dbTotalJamKerja;
          } else if (totalJamKerjaAbsensi === 0 && dbTotalJamKerja > 0) {
            totalJamKerjaAbsensi = dbTotalJamKerja;
          }
        } catch (e) {
          console.error("[getAllAbsensiDanIzinService] Error calculating actual work hours:", e);
          // Fallback ke DB value
          totalJamKerjaAbsensi = dbTotalJamKerja > 0 ? dbTotalJamKerja : 0;
        }
      } else if (item.jam_masuk && !item.jam_pulang && item.jamKerja) {
        // Jika hanya ada jam_masuk, estimasi dengan jam_pulang dari jamKerja
        try {
          const masuk = dayjs(item.jam_masuk);
          const jamPulangStr = String(item.jamKerja.jam_pulang || "17:00");
          const [hStr, mStr] = jamPulangStr.split(":").map(x => x.trim());
          const h = parseInt(hStr, 10) || 17;
          const m = parseInt(mStr, 10) || 0;
          
          const tglAbsensi = dayjs(item.tgl_absensi).hour(h).minute(m).second(0);
          const pulang = tglAbsensi;
          
          const durationSeconds = pulang.diff(masuk, "second");
          totalJamKerjaAbsensi = parseFloat((durationSeconds / 3600).toFixed(4));
          
          if (isNaN(totalJamKerjaAbsensi) || totalJamKerjaAbsensi < 0) {
            totalJamKerjaAbsensi = dbTotalJamKerja;
          }
        } catch (e) {
          console.error("[getAllAbsensiDanIzinService] Error estimating with jam_pulang from jamKerja:", e);
          totalJamKerjaAbsensi = dbTotalJamKerja;
        }
      } else if (!item.jam_masuk && item.jamKerja && (item.status === 'hadir' || item.status === 'terlambat')) {
        // Jika tidak ada jam_masuk, estimasi full day dari jamKerja
        try {
          const jamMasukStr = String(item.jamKerja.jam_masuk || "08:00");
          const jamPulangStr = String(item.jamKerja.jam_pulang || "17:00");
          
          const [hMasuk, mMasuk] = jamMasukStr.split(":").map(x => x.trim());
          const [hPulang, mPulang] = jamPulangStr.split(":").map(x => x.trim());
          
          const masuk = dayjs(item.tgl_absensi).hour(parseInt(hMasuk, 10) || 8).minute(parseInt(mMasuk, 10) || 0).second(0);
          const pulang = dayjs(item.tgl_absensi).hour(parseInt(hPulang, 10) || 17).minute(parseInt(mPulang, 10) || 0).second(0);
          
          const durationSeconds = pulang.diff(masuk, "second");
          totalJamKerjaAbsensi = parseFloat((durationSeconds / 3600).toFixed(4));
          
          if (isNaN(totalJamKerjaAbsensi) || totalJamKerjaAbsensi < 0) {
            totalJamKerjaAbsensi = dbTotalJamKerja;
          }
        } catch (e) {
          console.error("[getAllAbsensiDanIzinService] Error estimating full day from jamKerja:", e);
          totalJamKerjaAbsensi = dbTotalJamKerja;
        }
      } else if (dbTotalJamKerja > 0) {
        // Jika belum ada jam pulang, gunakan nilai dari database jika ada
        totalJamKerjaAbsensi = dbTotalJamKerja;
      }
      // Jika hanya ada jam_masuk (belum pulang dan tidak ada nilai di DB), totalJamKerjaAbsensi tetap 0
      
      gabungan.push({
        type: 'absensi',
        id_pegawai: item.id_pegawai,
        pegawai: item.pegawai,
        tgl_absensi: item.tgl_absensi,
        tanggal: item.tgl_absensi,
        jam_masuk: item.jam_masuk,
        jam_pulang: item.jam_pulang,
        status: item.status,
        status_pulang: item.status_pulang,
        jam_terlambat: item.jam_terlambat,
        total_jam_kerja: totalJamKerjaAbsensi,
        id_absensi: item.id_absensi,
        data: item,
      });
    });

    // 2. Proses izin
    izin.forEach(item => {
      const start = new Date(item.tgl_mulai);
      const end = new Date(item.tgl_selesai);
      
      // Hitung total jam kerja untuk izin berdasarkan bounded minutes
      let totalJamKerjaIzin = 0;
      if (defaultJamKerja) {
        const jamMasuk = item.pegawai?.jam_masuk_custom || defaultJamKerja.jam_masuk;
        const batasMasuk = defaultJamKerja.batas_masuk;
        totalJamKerjaIzin = calculateMinutesBetween(jamMasuk, batasMasuk);
      }
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        processedPegawaiIds.add(item.id_pegawai);
        gabungan.push({
          type: 'izin',
          id_pegawai: item.id_pegawai,
          pegawai: item.pegawai,
          tgl_mulai: item.tgl_mulai,
          tgl_selesai: item.tgl_selesai,
          tanggal: new Date(d),
          keterangan: item.keterangan,
          kategori_izin: item.kategori_izin,
          jenis_izin: item.jenis_izin,
          id_izin: item.id_izin,
          total_jam_kerja: totalJamKerjaIzin,
          data: item,
        });
      }
    });

    // 3. Jika tanpa range (default hari ini), tambahkan pegawai yang belum absen/izin
    if (!opts.tanggal_awal && !opts.tanggal_akhir) {
      allPegawai.forEach(peg => {
        if (!processedPegawaiIds.has(peg.id_pegawai)) {
          gabungan.push({
            type: 'belum_absen',
            id_pegawai: peg.id_pegawai,
            pegawai: peg,
            tanggal: new Date(),
            jam_masuk: null,
            jam_pulang: null,
            status: 'belum_absen',
            jam_terlambat: 0,
            total_jam_kerja: 0,
          });
        }
      });
    }

    gabungan.sort((a, b) => {
      // Prioritas: absensi/izin dulu, baru belum_absen; kemudian sort by name
      const typeOrder = { 'absensi': 0, 'izin': 0, 'belum_absen': 1 };
      const orderDiff = (typeOrder[a.type] || 2) - (typeOrder[b.type] || 2);
      if (orderDiff !== 0) return orderDiff;
      return (a.pegawai?.nama_lengkap || '').localeCompare(b.pegawai?.nama_lengkap || '');
    });

    return gabungan;
  },
};

module.exports = AbsensiService;
