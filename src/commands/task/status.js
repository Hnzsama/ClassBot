// src/commands/tugas/status.js
module.exports = {
    name: "#task-status",
    description: "Change task status (Manual). Format: #task-status [ID] done",
    execute: async (bot, from, sender, args, msg, text) => {
        if (!from.endsWith("@g.us")) return;

        const cleanText = text.replace("#task-status", "").replace("|", " ").trim();
        const parts = cleanText.split(/\s+/);

        if (parts.length < 2) {
            return bot.sock.sendMessage(from, {
                text: "⚠️ Format Salah!\nContoh: `#task-status 5 done` atau `#task-status 5 pending`"
            });
        }

        const taskId = parseInt(parts[0]);
        const statusArg = parts[1].toLowerCase();

        if (isNaN(taskId)) {
            return bot.sock.sendMessage(from, { text: "❌ ID harus angka." });
        }

        let newStatus = "Pending";
        if (["done", "selesai", "kelar", "sudah"].includes(statusArg)) {
            newStatus = "Selesai";
        } else if (["pending", "belum", "tunda"].includes(statusArg)) {
            newStatus = "Pending";
        } else {
            return bot.sock.sendMessage(from, { text: "❌ Status hanya: 'done' atau 'pending'." });
        }

        try {
            // 1. Cari Tugas & Validasi Grup (Dual Check via Relasi Class)
            const task = await bot.db.prisma.task.findFirst({
                where: {
                    id: taskId,
                    class: {
                        OR: [
                            { mainGroupId: from },
                            { inputGroupId: from }
                        ]
                    }
                }
            });

            if (!task) {
                return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });
            }

            // 2. Update Database
            await bot.db.prisma.task.update({
                where: { id: taskId },
                data: { status: newStatus }
            });

            // 3. Kirim Konfirmasi
            const icon = newStatus === "Selesai" ? "✅" : "⏳";

            await bot.sock.sendMessage(from, {
                text: `${icon} *STATUS DIPERBARUI*\n\n📚 Mapel: ${task.mapel}\n📝 Judul: ${task.judul}\n🔄 Status: *${newStatus.toUpperCase()}*\n\nOleh: @${sender.split("@")[0]}`,
                mentions: [sender]
            });

        } catch (e) {
            console.error(e);
            await bot.sock.sendMessage(from, { text: "❌ Gagal update status." });
        }
    }
};