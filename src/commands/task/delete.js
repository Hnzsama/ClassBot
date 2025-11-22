const fs = require('fs');
const path = require('path');

module.exports = {
  name: "#delete-task",
  description: "Hapus tugas. Format: #delete-task [ID 1] [ID 2]...",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Parse Multiple IDs (Mengubah semua argumen menjadi angka)
    const taskIds = args.map(arg => parseInt(arg)).filter(id => !isNaN(id) && id > 0);

    if (taskIds.length === 0) {
        return bot.sock.sendMessage(from, { text: "⚠️ Masukkan setidaknya satu ID tugas yang valid (Angka). Contoh: `#delete-task 5 12 14`" });
    }

    try {
        const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
        if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
        const classId = kelas.id;

        // 2. Ambil SEMUA tugas yang cocok dan milik kelas ini
        const tasksToDelete = await bot.db.prisma.task.findMany({
            where: { 
                id: { in: taskIds }, // Filter by array of IDs
                classId: classId 
            }
        });

        if (tasksToDelete.length === 0) {
            return bot.sock.sendMessage(from, { text: `❌ Tidak ditemukan tugas dengan ID: ${taskIds.join(', ')} di kelas ini.` });
        }
        
        let deletedCount = 0;
        let successfulDeletions = [];
        let failedDeletions = [];

        // 3. Sequential Deletion (File Fisik + DB Record untuk setiap tugas)
        for (const task of tasksToDelete) {
            
            // A. Delete File Fisik
            if (task.attachmentData) {
                try {
                    const attach = JSON.parse(task.attachmentData);
                    const filePath = attach.localFilePath;
                    
                    if (filePath && fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath); 
                    }
                } catch (e) {
                    // Hanya log error file, tidak membatalkan delete DB
                    console.error(`[DELETE] Gagal menghapus file untuk Task ${task.id}:`, e);
                }
            }

            // B. Delete DB Record
            try {
                await bot.db.prisma.task.delete({ where: { id: task.id } });
                deletedCount++;
                successfulDeletions.push(task.id);
            } catch (e) {
                // Jika database gagal delete (misal constraint), catat kegagalan
                failedDeletions.push(task.id);
                console.error(`[DELETE] Gagal menghapus DB record Task ${task.id}:`, e);
            }
        }

        // 4. Kirim Info & TAG PELAKU (Summary Report)
        let reply = `🗑️ *PENGHAPUSAN TUGAS SELESAI* 🗑️\n\n`;
        reply += `✅ *Berhasil Dihapus:* ${deletedCount} tugas (IDs: ${successfulDeletions.join(', ')})\n`;
        if (failedDeletions.length > 0) {
            reply += `❌ *Gagal Dihapus:* ${failedDeletions.length} tugas (IDs: ${failedDeletions.join(', ')}). Cek log konsol.\n`;
        }
        
        reply += `\nOleh: @${sender.split("@")[0]}`;

        await bot.sock.sendMessage(from, {
            text: reply,
            mentions: [sender]
        });

    } catch (e) {
        console.error("Error multi-delete:", e);
        await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan saat menghapus tugas." });
    }
  }
};