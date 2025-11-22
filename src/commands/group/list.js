// src/commands/group/listGrup.js
module.exports = {
  name: "#list-grup",
  description: "Menampilkan daftar tugas kelompok yang tersimpan.",
  execute: async (bot, from, sender, args, msg) => {
    try {
      // 1. Cari Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Ambil History Assignment
      const assignments = await bot.db.prisma.groupAssignment.findMany({
        where: { classId: kelas.id },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { subGroups: true } }
        }
      });

      if (assignments.length === 0) {
        return await bot.sock.sendMessage(from, { text: "❌ Belum ada riwayat pembagian kelompok." });
      }

      let text = `📂 *RIWAYAT PEMBAGIAN KELOMPOK*\n`;
      text += `🏫 Kelas: *${kelas.name}*\n`;
      text += `╰──────────────────────\n`;
      
      assignments.forEach((tugas) => {
        const tgl = tugas.createdAt.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' });
        
        text += `\n🆔 *ID: ${tugas.id}* | 📅 ${tgl}\n`;
        text += `📚 *${tugas.judul}*\n`;
        text += `👥 Total: ${tugas._count.subGroups} Kelompok\n`;
        text += `──────────────────────`; // Separator antar item
      });

      text += `\n\n💡 *Lihat Detail:* \`#detail-grup [ID]\``;
      
      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil data." });
    }
  },
};