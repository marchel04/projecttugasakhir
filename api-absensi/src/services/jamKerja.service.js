const { toLocal } = require("../utils/datetimeHandler.js");
const prisma = require("../utils/prisma.js");

const JamKerjaService = {
  getAllJamKerjaService: async function () {
    return await prisma.jamKerja.findMany({
      orderBy: { id_jam: "asc" },
    });
  },

  getJamKerjaServiceById: async function (id) {
    return await prisma.jamKerja.findUnique({
      where: { id_jam: Number(id) },
    });
  },

  createJamKerjaService: async function (data) {
    return await prisma.jamKerja.create({
      data: {
        ...data,
        jam_masuk: data.jam_masuk,
        batas_masuk: data.batas_masuk,
        jam_pulang: data.jam_pulang,
      },
    });
  },

  updateJamKerjaService: async function (id, data) {
    return await prisma.jamKerja.update({
      where: { id_jam: Number(id) },
      data: {
        ...data,
        jam_masuk: data.jam_masuk,
        batas_masuk: data.batas_masuk,
        jam_pulang: data.jam_pulang,
      },
    });
  },

  deleteJamKerjaService: async function (id) {
    return await prisma.jamKerja.delete({
      where: { id_jam: Number(id) },
    });
  },
};

module.exports = JamKerjaService;
