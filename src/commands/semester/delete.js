// src/commands/semester/delete.js
module.exports = {
  name: "#delete-semester",
  description: "Hapus semester. Format: #delete-semester [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    const id = parseInt(args[0]);
    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID Semester yang ingin dihapus." });

    try {
      // 1. Cek Kelas
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      
      // 2. Cek Keberadaan & Status
      const sem = await bot.db.prisma.semester.findFirst({
        where: { id: id, classId: kelas.id },
        include: { 
          _count: { select: { subjects: true } }, 
        }
      });

      if (!sem) return bot.sock.sendMessage(from, { text: `❌ Semester ID ${id} tidak ditemukan.` });

      // 3. PROTEKSI: Jangan hapus jika aktif
      if (sem.isActive) {
        return bot.sock.sendMessage(from, { 
          text: `⛔ *AKSES DITOLAK*\n\nSemester *${sem.name}* sedang AKTIF.\nAnda tidak bisa menghapus semester yang sedang berjalan.\n\n_Solusi: Aktifkan semester lain terlebih dahulu._` 
        });
      }

      // 4. Hapus (Cascade delete subjects)
      const deletedName = sem.name;
      const subjectsCount = sem._count.subjects;
      
      await bot.db.prisma.semester.delete({ where: { id } });
      
      // 5. Respon Laporan
      let reply = `🗑️ *SEMESTER DIHAPUS*\n`;
      reply += `──────────────────────\n`;
      reply += `🏫 Kelas: ${kelas.name}\n`;
      reply += `❌ Target: *${deletedName}* (ID: ${id})\n\n`;
      
      reply += `📉 *Dampak Penghapusan:*\n`;
      if (subjectsCount > 0) {
          reply += `• ${subjectsCount} Mata Kuliah ikut terhapus.\n`;
          reply += `• Seluruh tugas terkait mapel tersebut terhapus.\n`;
      } else {
          reply += `• Tidak ada mata kuliah yang terdampak (Kosong).\n`;
      }
      
      reply += `──────────────────────\n`;
      reply += `👤 Dihapus oleh: @${sender.split("@")[0]}`;

      await bot.sock.sendMessage(from, { text: reply, mentions: [sender] });

    } catch (e) {
      console.error("Error delete-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal menghapus semester." });
    }
  }
};