// commands/general/listGrup.js
module.exports = {
  name: "#list-grup",
  description: "Menampilkan daftar tugas kelompok yang tersimpan.",
  execute: async (bot, from, sender, args, msg) => {
    try {
      // Ambil semua assignment di grup WA ini
      const assignments = await bot.db.prisma.groupAssignment.findMany({
        where: { waGroupId: from },
        orderBy: { createdAt: 'desc' }, // Yang terbaru paling atas
        include: {
          _count: {
            select: { subGroups: true } // Hitung jumlah kelompoknya
          }
        }
      });

      if (assignments.length === 0) {
        return await bot.sock.sendMessage(from, { text: "❌ Belum ada riwayat pembagian kelompok." });
      }

      let text = `📂 *RIWAYAT PEMBAGIAN KELOMPOK*\n\n`;
      
      assignments.forEach((tugas) => {
        const tgl = tugas.createdAt.toLocaleDateString("id-ID");
        text += `🆔 *ID: ${tugas.id}*\n`;
        text += `📚 *${tugas.judul}*\n`;
        text += `📅 ${tgl} | 👥 ${tugas._count.subGroups} Kelompok\n`;
        text += `──────────────────\n`;
      });

      text += `\n_Gunakan #detail-grup [ID] untuk melihat anggota._`;
      
      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil data." });
    }
  },
};