const bcrypt = require("bcryptjs");
const { generateToken, verifyToken } = require("../utils/jwtHandler.js");
const {
  sendBadRequestResponse,
  sendUnauthorizedResponse,
  sendSuccessResponse,
  sendSuccessNoDataResponse,
} = require("../utils/responseHandler.js");
const LoginService = require("../services/login.service.js");

// ==================== DOKUMENTASI AUTH CONTROLLER ====================
// Controller untuk menangani autentikasi user (login, logout, dan mengambil data user saat ini)
// Menggunakan JWT token yang disimpan di cookie untuk autentikasi
// =====================================================================

// -------- VALIDASI LOGIN --------
// Fungsi: Memvalidasi bahwa NIP dan password wajib ada di request body
// Return: Lanjut ke handler berikutnya jika valid, atau error jika tidak valid
function validateLoginData(req, res, next) {
  const { nip, password } = req.body;
  if (!nip || !password) {
    return sendBadRequestResponse(res, "NIP dan password wajib diisi");
  }
  next();
}

// -------- LOGIN --------
// Fungsi: Memproses login user dengan NIP dan password
// Validasi: Cek NIP ada di database dan password cocok
// Output: Set JWT token di cookie dan return NIP user
// Fitur: Support "remember me" untuk token berlaku 30 hari
async function login(req, res, next) {
  try {
    const { nip, password, remember = false } = req.body;

    const login = await LoginService.getLoginServiceByNip(nip);
    if (!login) {
      return sendUnauthorizedResponse(res, "Credentials Error");
    }

    const valid = await bcrypt.compare(password, login.password);
    if (!valid) {
      return sendUnauthorizedResponse(res, "Credentials Error");
    }

    const expiresIn = remember ? "30d" : "1d";
    const maxAge = remember
      ? 30 * 24 * 60 * 60 * 1000
      : undefined; // session cookie kalau tidak remember

    const token = generateToken({ nip: login.nip }, expiresIn);

  res.cookie("jwt", token, {
  httpOnly: true,
  secure: process.env.APP_ENV !== "development",
  sameSite: "lax",
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: "/",
  ...(remember ? { maxAge } : {}),
});

    return sendSuccessResponse(
      res,
      { nip: login.nip },
      "Login successful"
    );
  } catch (error) {
    next(error);
  }
}


// -------- LOGOUT --------
// Fungsi: Menghapus JWT token dari cookie untuk logout user
// Output: Response sukses tanpa data
async function logout(req, res, next) {
  try {
    res.clearCookie("jwt", {
  httpOnly: true,
  secure: process.env.APP_ENV !== "development",
  sameSite: "lax",
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: "/",
});
    return sendSuccessNoDataResponse(res, "Logout successful");
  } catch (error) {
    next(error);
  }
}

// -------- GET ME (GET CURRENT USER) --------
// Fungsi: Mengambil data user yang sedang login berdasarkan JWT token di cookie
// Validasi: Token harus ada dan valid
// Output: Data user (nip, nama, role, foto profil) atau error jika token invalid
async function getMe(req, res, next) {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return sendUnauthorizedResponse(res, "Token tidak ditemukan");
    }

    const decoded = verifyToken(token);
    const login = await LoginService.getLoginServiceByNip(decoded.nip);

    if (!login) {
      return sendUnauthorizedResponse(res, "Data tidak ditemukan");
    }

    const responseData = {
      id_pegawai: login.pegawai?.id_pegawai,
      nip: login.nip,
      nama_lengkap: login.pegawai?.nama_lengkap,
      role: login.pegawai?.role,
      foto_profil: login.pegawai?.foto_profil
    };

    return sendSuccessResponse(res, responseData);
  } catch (err) {
    return sendUnauthorizedResponse(
      res,
      "Token tidak valid atau telah kedaluwarsa"
    );
  }
}

// -------- FORGOT PASSWORD --------
// Fungsi: Generate password sementara untuk user yang lupa password
// Proses: Generate password random dengan format NIP_HARI_BULAN_TAHUN, hash, dan simpan
// Output: Return password sementara (untuk demo, atau akan dikirim via email)
async function forgotPassword(req, res, next) {
  try {
    const { nip } = req.body;

    if (!nip) {
      return sendBadRequestResponse(res, "NIP wajib diisi");
    }

    const login = await LoginService.getLoginServiceByNip(nip);
    if (!login) {
      return sendBadRequestResponse(res, "NIP tidak ditemukan");
    }

    // Generate password sementara (contoh: format NIP_hari_bulan_tahun)
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const tempPassword = `${nip}_${day}${month}${year}`;

    // Hash password sementara
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Simpan password sementara ke database
    await LoginService.updateLoginService(nip, {
      password: hashedPassword,
    });

    return sendSuccessResponse(
      res,
      { nip, tempPassword },
      "Password sementara telah dikirim (cek console atau log untuk demo)"
    );
  } catch (error) {
    next(error);
  }
}

// -------- ADMIN RESET PASSWORD PEGAWAI --------
// Fungsi: Admin dapat mereset password pegawai tertentu
// Validasi: NIP dan password baru harus ada, password minimal 6 karakter
// Output: Return NIP pegawai yang password-nya berhasil direset
async function adminResetPasswordPegawai(req, res, next) {
  try {
    // Accept nip from URL params or body
    const nipParam = req.params?.nip;
    const { nip: nipBody, newPassword } = req.body || {};
    const nip = nipBody || nipParam;

    if (!nip || !newPassword) {
      return sendBadRequestResponse(res, "NIP dan password baru wajib diisi");
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return sendBadRequestResponse(res, "Password minimal 6 karakter");
    }

    const login = await LoginService.getLoginServiceByNip(nip);
    if (!login) {
      return sendBadRequestResponse(res, "NIP tidak ditemukan");
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await LoginService.updateLoginService(nip, {
      password: hashedPassword,
    });

    return sendSuccessResponse(res, { nip }, "Password pegawai berhasil diubah");
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateLoginData,
  login,
  logout,
  getMe,
  forgotPassword,
  adminResetPasswordPegawai,
};
