// src/commands/semester/list.js
module.exports = {
  name: "#list-semester",
  description: "Menampilkan daftar semester kelas ini.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Cari Kelas & Validasi
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan `#add-class`." });

      // 2. Query Semesters
      const semesters = await bot.db.prisma.semester.findMany({
        where: { classId: kelas.id },
        include: {
          _count: { select: { subjects: true } } 
        },
        orderBy: { id: 'asc' }
      });

      if (semesters.length === 0) {
          return bot.sock.sendMessage(from, { 
              text: `❌ Belum ada semester yang dibuat untuk kelas *${kelas.name}*.\nGunakan \`#add-semester-ai [Angka]\` untuk membuatnya otomatis.` 
          });
      }

      // 3. Format Output Keren
      let text = `╭── 📅 *HISTORY SEMESTER*\n`;
      text += `│ 🏫 Kelas: *${kelas.name}*\n`;
      text += `╰──────────────────────\n`;

      semesters.forEach((s) => {
        const statusIcon = s.isActive ? "✅ AKTIF" : "⚪";
        const activeStyle = s.isActive ? "*[SEDANG BERJALAN]*" : "";
        
        text += `\n${statusIcon} *${s.name}* ${activeStyle}\n`;
        text += `   ├ 🆔 ID: \`${s.id}\`\n`; // Monospace ID
        text += `   └ 📚 Mapel: ${s._count.subjects} mata kuliah\n`;
      });

      // 4. Quick Actions yang Lebih Lengkap
      text += `\n──────────────────────\n`;
      text += `💡 *Quick Action:*\n`;
      text += `• Aktifkan: \`#edit-semester [ID] status 1\`\n`;
      text += `• Hapus: \`#delete-semester [ID]\`\n`;
      text += `• Tambah: \`#add-semester-ai [Angka]\``;

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error("Error list-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  }
};