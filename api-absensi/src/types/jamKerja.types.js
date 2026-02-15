const { z } = require("zod");

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const JamKerjaSchema = z.object({
    nama_jam: z.string().min(1).max(191),
    jam_masuk: z.string().regex(timeRegex),
    batas_masuk: z.string().regex(timeRegex),
    jam_pulang: z.string().regex(timeRegex),
});

const JamKerjaUpdateSchema = JamKerjaSchema.partial();

module.exports = { JamKerjaSchema, JamKerjaUpdateSchema };