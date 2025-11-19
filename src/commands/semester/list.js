module.exports = {
  name: "#list-semester",
  description: "Menampilkan daftar semester.",
  execute: async (bot, from, sender, args, msg) => {
    try {
      const semesters = await bot.db.prisma.semester.findMany({
        include: {
          _count: { select: { subjects: true, classes: true } }
        },
        orderBy: { id: 'asc' }
      });

      if (semesters.length === 0) return bot.sock.sendMessage(from, { text: "❌ Belum ada data semester." });

      let text = `📅 *DAFTAR SEMESTER*\n────────────────\n`;
      semesters.forEach((s) => {
        const status = s.isActive ? "✅ [AKTIF]" : "⚪";
        text += `${status} *ID: ${s.id}* - ${s.name}\n`;
        text += `   └ ${s._count.subjects} Mapel | Digunakan ${s._count.classes} Kelas\n`;
      });
      text += `\n_Gunakan #edit-semester [ID] status 1 untuk mengaktifkan._`;

      await bot.sock.sendMessage(from, { text });
    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Error database." });
    }
  }
};