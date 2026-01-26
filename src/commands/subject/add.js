// src/commands/mapel/add.js

// --- FUNGSI UTAMA DATABASE (SHARED UTILITY) ---
async function addSubjectsToDb(bot, from, sender, namesArray, semesterId, className, isAI = false) {
    const { sock, db } = bot;

    const rawNames = namesArray.map(n => n.trim()).filter(n => n.length > 0);
    if (rawNames.length === 0) {
        return sock.sendMessage(from, { text: "⚠️ Tidak ada nama mata kuliah yang terbaca." });
    }

    // 1. Cek Duplikat (Hanya di semester ini)
    const existingSubjects = await db.prisma.subject.findMany({
        where: { semesterId: semesterId },
        select: { name: true }
    });

    // Set nama yang sudah ada (lowercase biar case-insensitive)
    const existingNames = new Set(existingSubjects.map(sub => sub.name.toLowerCase()));

    const payload = [];
    const errors = [];
    const addedNames = [];

    rawNames.forEach(name => {
        if (existingNames.has(name.toLowerCase())) {
            errors.push(`• ${name} (Sudah ada)`);
        } else {
            payload.push({
                name: name,
                semesterId: semesterId,
            });
            addedNames.push(name);
            existingNames.add(name.toLowerCase());
        }
    });

    if (payload.length === 0) {
        let errMsg = isAI ? "❌ AI tidak menemukan mapel baru." : "❌ Semua mapel sudah terdaftar.";
        if (errors.length > 0) errMsg += `\n\n📋 *Detail:*\n${errors.join('\n')}`;
        return sock.sendMessage(from, { text: errMsg });
    }

    // 2. Eksekusi Simpan
    const result = await db.prisma.subject.createMany({
        data: payload,
    });

    let successMsg = `✅ *${result.count} MAPEL DITAMBAHKAN*\n`;
    successMsg += `🏫 Kelas: ${className}\n`;
    successMsg += `────────────────\n`;
    successMsg += `📚 ${addedNames.join(', ')}`;

    if (errors.length > 0) {
        successMsg += `\n\n⚠️ *Dilewati (${errors.length}):*\n${errors.join('\n')}`;
    }

    await sock.sendMessage(from, {
        text: successMsg,
        mentions: [sender]
    });
}

module.exports = {
    name: "#subject-add",
    alias: ["#mapel"],
    description: "Add subjects. Format: #subject-add [Name 1], [Name 2]",
    execute: async (bot, from, sender, args, msg, text) => {
        if (!from.endsWith("@g.us")) return;

        const rawContent = text.replace("#mapel", "").trim();

        if (!rawContent) {
            return bot.sock.sendMessage(from, {
                text: "⚠️ *Format Tambah Mapel*\n\nGunakan koma ( , ) untuk pemisah.\n\nContoh:\n`#mapel Basis Data, Aljabar Linear, Bahasa Inggris`"
            });
        }

        try {
            // 1. Cek Kelas & Semester Aktif
            const kelas = await bot.db.prisma.class.findFirst({
                where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
                include: { semesters: { where: { isActive: true } } }
            });

            if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

            const activeSem = kelas.semesters[0];
            if (!activeSem) {
                return bot.sock.sendMessage(from, { text: "❌ Belum ada Semester Aktif. Gunakan `#semester` lalu aktifkan dulu." });
            }

            // 2. Parsing Input (Koma atau Enter)
            const namesToProcess = rawContent.split(/[,\n]+/).map(n => n.trim()).filter(n => n.length > 0);

            // 3. Panggil Fungsi Database
            return addSubjectsToDb(bot, from, sender, namesToProcess, activeSem.id, kelas.name, false);

        } catch (e) {
            console.error("Error add-mapel:", e);
            await bot.sock.sendMessage(from, { text: "❌ Gagal tambah mapel." });
        }
    },
    // Export fungsi ini
    addSubjectsToDb: addSubjectsToDb
};