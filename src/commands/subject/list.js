module.exports = {
  name: "#list-mapel",
  description: "Lihat daftar mapel di semester aktif.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: {
          semesters: {
            where: { isActive: true },
            include: { subjects: { orderBy: { name: 'asc' } } }
          }
        }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      
      const activeSem = kelas.semesters[0];
      if (!activeSem) return bot.sock.sendMessage(from, { text: "❌ Belum ada Semester Aktif." });

      const subjects = activeSem.subjects;
      if (subjects.length === 0) return bot.sock.sendMessage(from, { text: `📂 Belum ada mapel di *${activeSem.name}*.` });

      // --- FORMAT TAMPILAN BARU ---
      let text = `📚 *MATA KULIAH KELAS*\n`;
      text += `🏫 *${kelas.name}*\n`;
      text += `📅 ${activeSem.name}\n`;
      text += `──────────────────────\n`;
      
      subjects.forEach((sub) => {
        // Menggunakan bullet point buku dan indentasi untuk ID
        text += `📘 *${sub.name}*\n`;
        text += `   └ 🆔 ID: \`${sub.id}\`\n`; 
      });

      text += `──────────────────────\n`;
      text += `💡 *Edit:* \`#edit-mapel [ID] | [Nama]\`\n`;
      text += `💡 *Hapus:* \`#delete-mapel [ID]\``;
      
      await bot.sock.sendMessage(from, { text });

    } catch (e) {   
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  }
};