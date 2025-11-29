const fs = require('fs');
const path = require('path');

module.exports = {
  name: "#delete-task",
  description: "Hapus tugas. Format: #delete-task [ID 1] [ID 2]...",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Parse Multiple IDs
    const taskIds = args.map(arg => parseInt(arg)).filter(id => !isNaN(id) && id > 0);

    if (taskIds.length === 0) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ *Format Salah*\n\nMasukkan ID tugas yang ingin dihapus (bisa banyak).\nContoh: `#delete-task 15 16`\n\n_(Cek ID di #list-task)_" 
        });
    }

    try {
        // 2. Cek Kelas (Dual Group Check)
        const kelas = await bot.db.prisma.class.findFirst({
            where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
        });
        
        if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

        // 3. Ambil data tugas yang mau dihapus (untuk laporan nama tugas)
        const tasksToDelete = await bot.db.prisma.task.findMany({
            where: { 
                id: { in: taskIds }, 
                classId: kelas.id 
            }
        });

        if (tasksToDelete.length === 0) {
            return bot.sock.sendMessage(from, { text: `❌ Tidak ditemukan tugas dengan ID tersebut di kelas ini.` });
        }
        
        const deletedLog = []; // Menyimpan judul tugas yang berhasil dihapus
        const failedLog = [];

        // 4. Sequential Deletion
        for (const task of tasksToDelete) {
            // A. Hapus File Fisik (Jika ada)
            if (task.attachmentData) {
                try {
                    const attach = JSON.parse(task.attachmentData);
                    if (attach.localFilePath && fs.existsSync(attach.localFilePath)) {
                        fs.unlinkSync(attach.localFilePath); 
                    }
                } catch (e) {
                    console.error(`[DELETE-FILE] Error task ${task.id}:`, e);
                }
            }

            // B. Hapus Database
            try {
                await bot.db.prisma.task.delete({ where: { id: task.id } });
                deletedLog.push(`• ~${task.judul}~ (ID: ${task.id})`);
            } catch (e) {
                console.error(`[DELETE-DB] Error task ${task.id}:`, e);
                failedLog.push(`ID ${task.id}`);
            }
        }

        // 5. Laporan Penghapusan Keren
        let reply = `🗑️ *LAPORAN PENGHAPUSAN TUGAS*\n`;
        reply += `──────────────────────\n`;
        reply += `🏫 Kelas: ${kelas.name}\n`;
        reply += `📊 Status: ${deletedLog.length} item dihapus\n\n`;

        if (deletedLog.length > 0) {
            reply += `✅ *Berhasil Dihapus:*\n`;
            reply += deletedLog.join('\n');
            reply += `\n`;
        }

        if (failedLog.length > 0) {
            reply += `⛔ *Gagal Dihapus:*\n`;
            reply += failedLog.join(', ');
            reply += `\n`;
        }
        
        reply += `──────────────────────\n`;
        reply += `👤 Oleh: @${sender.split("@")[0]}`;

        await bot.sock.sendMessage(from, {
            text: reply,
            mentions: [sender]
        });

    } catch (e) {
        console.error("Error multi-delete task:", e);
        await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem saat menghapus tugas." });
    }
  }
};