// commands/semester/delete.js
module.exports = {
  name: "#delete-semester",
  description: "Hapus semester. Format: #delete-semester [ID]",
  execute: async (bot, from, sender, args, msg) => {
    const id = parseInt(args[0]);
    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID Semester." });

    try {
      // 1. Cek Keberadaan & Relasi
      const sem = await bot.db.prisma.semester.findUnique({
        where: { id },
        include: { 
          _count: { select: { classes: true } },
          classes: { select: { name: true } } // Ambil nama kelas yang pakai
        }
      });

      if (!sem) return bot.sock.sendMessage(from, { text: "❌ Data semester tidak ditemukan." });

      // 2. PROTEKSI: Jangan hapus jika ada kelas yang assign
      if (sem._count.classes > 0) {
        const classNames = sem.classes.map(c => c.name).join(", ");
        return bot.sock.sendMessage(from, { 
          text: `⛔ *TIDAK BISA DIHAPUS!*\n\nSemester *${sem.name}* sedang digunakan oleh ${sem._count.classes} kelas:\n_${classNames}_\n\nSilahkan pindahkan kelas-kelas tersebut ke semester lain dulu menggunakan command:\n\`#edit-class semester [ID_Baru]\` di grup masing-masing.` 
        });
      }

      // 3. Hapus (Cascade akan menghapus Subjects/Mapel didalamnya, tapi aman karena Kelas tidak pakai)
      await bot.db.prisma.semester.delete({ where: { id } });
      await bot.sock.sendMessage(from, { text: `✅ Semester *${sem.name}* dan semua mapel di dalamnya berhasil dihapus.` });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus semester." });
    }
  }
};