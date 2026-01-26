// src/commands/mapel/list.js
module.exports = {
  name: "#subject-list",
  alias: ["#mapel-list"],
  description: "Show list of subjects for active semester.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Ambil Data Kelas & Mapel di Semester Aktif
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: {
          semesters: {
            where: { isActive: true },
            include: { subjects: { orderBy: { name: 'asc' } } } // Urut Abjad A-Z
          }
        }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      const activeSem = kelas.semesters[0];
      if (!activeSem) return bot.sock.sendMessage(from, {
        text: "❌ Belum ada Semester Aktif.\nGunakan `#list-semester` untuk cek status."
      });

      const subjects = activeSem.subjects;
      if (subjects.length === 0) return bot.sock.sendMessage(from, {
        text: `📂 Belum ada mapel di *${activeSem.name}*.\nGunakan \`#mapel\` untuk menambah.`
      });

      // 2. Format Tampilan Keren
      let text = `📚 *DAFTAR MATA KULIAH*\n`;
      text += `🏫 Kelas: ${kelas.name}\n`;
      text += `📅 Semester: *${activeSem.name}*\n`;
      text += `📊 Total: ${subjects.length} Matkul\n`;
      text += `──────────────────────\n`;

      subjects.forEach((sub, index) => {
        // Penomoran biar mudah dibaca
        const num = index + 1;
        text += `${num}. 📘 *${sub.name}*\n`;
        text += `    🆔 ID: \`${sub.id}\`\n`; // Indentasi ID agar menjorok
      });

      // 3. Footer Actions (Konsisten Koma)
      text += `──────────────────────\n`;
      text += `💡 *Kelola Mapel:*\n`;
      text += `• Edit: \`#edit-mapel [ID] [NamaBaru]\`\n`;
      text += `• Hapus: \`#delete-mapel [ID]\``;

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error("Error list-mapel:", e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  }
};