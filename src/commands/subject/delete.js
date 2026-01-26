// src/commands/mapel/delete.js
module.exports = {
    name: "#subject-delete",
    alias: ["#mapel-del"],
    description: "Delete subjects. Format: #subject-delete [ID 1] [ID 2]... (--force)",
    execute: async (bot, from, sender, args, msg, text) => {
        if (!from.endsWith("@g.us")) return;

        // 1. Parse Input (Ambil semua angka dari argumen)
        const isForce = text.includes("--force");
        const dbIds = args.filter(arg => !isNaN(parseInt(arg))).map(id => parseInt(id));

        if (dbIds.length === 0) {
            return bot.sock.sendMessage(from, {
                text: "⚠️ *Format Salah*\n\nMasukkan ID Mapel yang ingin dihapus (bisa banyak sekaligus).\nContoh: `#delete-mapel 55 56`\n\n_(Cek ID di #list-mapel)_"
            });
        }

        try {
            // 2. Cari Kelas & Validasi Semester (Security)
            const kelas = await bot.db.prisma.class.findFirst({
                where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
                include: { semesters: { select: { id: true } } }
            });

            if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas tidak ditemukan." });

            const validSemesterIds = kelas.semesters.map(s => s.id);
            if (validSemesterIds.length === 0) return bot.sock.sendMessage(from, { text: "❌ Kelas ini belum memiliki semester." });

            // 3. Ambil subjects target
            const subjectsToDelete = await bot.db.prisma.subject.findMany({
                where: {
                    id: { in: dbIds },
                    semesterId: { in: validSemesterIds }
                },
                select: { id: true, name: true }
            });

            if (subjectsToDelete.length === 0) {
                return bot.sock.sendMessage(from, { text: `❌ Tidak ditemukan mapel dengan ID: ${dbIds.join(', ')} di kelas ini.` });
            }

            // 4. Proses Filter & Validasi Tugas
            const finalIdsToDelete = [];
            const successLog = [];
            const blockedLog = [];

            for (const target of subjectsToDelete) {
                // Cek tugas terkait
                const relatedTasks = await bot.db.prisma.task.count({
                    where: {
                        classId: kelas.id,
                        mapel: target.name
                    }
                });

                // Logic Block vs Force
                if (relatedTasks > 0 && !isForce) {
                    blockedLog.push({
                        name: target.name,
                        id: target.id,
                        reason: `${relatedTasks} tugas aktif`
                    });
                } else {
                    // Masukkan ke antrean hapus
                    finalIdsToDelete.push(target.id);
                    successLog.push({
                        name: target.name,
                        id: target.id
                    });
                }
            }

            // 5. Eksekusi Delete Massal
            if (finalIdsToDelete.length > 0) {
                await bot.db.prisma.subject.deleteMany({
                    where: { id: { in: finalIdsToDelete } }
                });
            }

            // 6. Susun Laporan Keren
            let reply = `🗑️ *LAPORAN PENGHAPUSAN MAPEL*\n`;
            reply += `──────────────────────\n`;

            // Section Sukses
            if (successLog.length > 0) {
                reply += `✅ *Berhasil Dihapus (${successLog.length}):*\n`;
                successLog.forEach(item => {
                    reply += `• ~${item.name}~ (ID: ${item.id})\n`;
                });
                reply += `\n`;
            }

            // Section Gagal/Blocked
            if (blockedLog.length > 0) {
                reply += `⛔ *Gagal / Ditahan (${blockedLog.length}):*\n`;
                blockedLog.forEach(item => {
                    reply += `• *${item.name}* (ID: ${item.id})\n`;
                    reply += `   └ ⚠️ Tertahan: Ada ${item.reason}.\n`;
                });

                reply += `\n💡 *Solusi:* Tambahkan \`--force\` di akhir perintah untuk memaksa hapus.\n`;
                reply += `_Contoh: #delete-mapel ${blockedLog[0].id} --force_`;
            }

            reply += `\n──────────────────────\n`;
            reply += `👤 Oleh: @${sender.split("@")[0]}`;

            await bot.sock.sendMessage(from, {
                text: reply,
                mentions: [sender]
            });

        } catch (e) {
            console.error("Error delete-mapel:", e);
            await bot.sock.sendMessage(from, { text: "❌ Gagal menghapus mapel." });
        }
    }
};