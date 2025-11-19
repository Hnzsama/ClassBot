module.exports = {
  name: "#list-mapel",
  description: "Lihat daftar mapel di semester aktif.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Cari Kelas & Semester Aktif
      const kelas = await bot.db.prisma.class.findUnique({
        where: { groupId: from },
        include: {
          semesters: {
            where: { isActive: true }, // Hanya ambil semester aktif
            include: { 
              subjects: { orderBy: { name: 'asc' } } 
            }
          }
        }
      });

      // Validasi
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan `#add-class`." });
      
      const activeSem = kelas.semesters[0];
      if (!activeSem) return bot.sock.sendMessage(from, { text: "❌ Belum ada Semester Aktif. Gunakan `#add-semester` lalu aktifkan." });

      const subjects = activeSem.subjects;
      if (subjects.length === 0) return bot.sock.sendMessage(from, { text: `❌ Belum ada mapel di *${activeSem.name}*.` });

      // 2. Tampilkan Output
      let text = `📚 *MAPEL KELAS ${kelas.name}*\n`;
      text += `📅 ${activeSem.name}\n────────────────\n`;
      
      subjects.forEach((sub, i) => {
        text += `${i + 1}. ${sub.name}\n`;
      });

      text += `\n_Total: ${subjects.length} Mata Kuliah_`;
      await bot.sock.sendMessage(from, { text });

    } catch (e) {   
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  }
};