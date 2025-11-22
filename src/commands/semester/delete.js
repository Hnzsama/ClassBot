// commands/semester/delete.js
module.exports = {
  name: "#delete-semester",
  description: "Hapus semester. Format: #delete-semester [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    const id = parseInt(args[0]);
    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID Semester." });

    try {
      // FIX: Gunakan Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      const classId = kelas.id;
      
      // 2. Cek Keberadaan & Status Aktif
      const sem = await bot.db.prisma.semester.findFirst({
        where: { id: id, classId: classId },
        include: { 
          _count: { select: { subjects: true } }, 
        }
      });

      if (!sem) return bot.sock.sendMessage(from, { text: `❌ Data semester ID ${id} tidak ditemukan di kelas ini.` });

      // 3. PROTEKSI: Jangan hapus jika sedang aktif
      if (sem.isActive) {
        return bot.sock.sendMessage(from, { 
          text: `⛔ *GAGAL HAPUS!*\n\nSemester *${sem.name}* sedang AKTIF.\n\nSilahkan nonaktifkan/pindahkan kelas ke semester lain dulu.` 
        });
      }

      // 4. Hapus (Cascade akan menghapus Subjects/Mapel)
      const deletedName = sem.name;
      const subjectsCount = sem._count.subjects;
      
      await bot.db.prisma.semester.delete({ where: { id } });
      
      await bot.sock.sendMessage(from, { 
        text: `✅ Semester *${deletedName}* (dan ${subjectsCount} mapel di dalamnya) berhasil dihapus.`,
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus semester." });
    }
  }
};