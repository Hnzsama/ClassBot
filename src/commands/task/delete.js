module.exports = {
  name: "#delete-task",
  description: "Hapus tugas. Format: #delete-task [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    if (args.length < 1) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID Tugas (Salin dari #list-task)." });

    // 1. UBAH INPUT KE INTEGER
    const taskId = parseInt(args[0]);

    if (isNaN(taskId)) {
        return bot.sock.sendMessage(from, { text: "❌ ID harus berupa angka." });
    }

    try {
        // 2. Cek Task & Validasi Kelas (Security Check)
        // Pastikan task ID tersebut memang milik grup ini
        const task = await bot.db.prisma.task.findFirst({
            where: { 
                id: taskId,
                class: { groupId: from } 
            }
        });

        if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

        // 3. Hapus
        await bot.db.prisma.task.delete({ where: { id: taskId } });

        // 4. Kirim Info & TAG PELAKU
        await bot.sock.sendMessage(from, {
            text: `🗑️ *TUGAS DIHAPUS*\n\nMapel: ${task.mapel}\nJudul: ${task.judul}\n\nDihapus oleh: @${sender.split("@")[0]}`,
            mentions: [sender]
        });

    } catch (e) {
        console.error(e);
        await bot.sock.sendMessage(from, { text: "❌ Gagal hapus tugas." });
    }
  }
};