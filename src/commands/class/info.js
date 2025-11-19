module.exports = {
  name: "#info-class",
  description: "Menampilkan informasi detail kelas & semester aktif.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Ambil Data Kelas + Semester Aktif + Count Relasi
      const kelas = await bot.db.prisma.class.findUnique({
        where: { groupId: from },
        include: {
          // Ambil hanya semester yang aktif
          semesters: {
            where: { isActive: true },
            include: {
              _count: { select: { subjects: true } } // Hitung mapel di semester aktif
            }
          },
          // Hitung total member & tugas
          _count: {
            select: { 
              members: true, 
              tasks: true,
              assignments: true // History random group
            }
          }
        }
      });

      if (!kelas) {
        return bot.sock.sendMessage(from, { 
          text: "❌ Grup ini belum terdaftar sebagai kelas.\nKetik `#add-class [Nama]` untuk mendaftar." 
        });
      }

      // Cek Semester Aktif
      const activeSem = kelas.semesters[0]; 
      const semesterName = activeSem ? `✅ ${activeSem.name}` : "⚠️ Belum ada yang aktif";
      const mapelCount = activeSem ? activeSem._count.subjects : 0;
      const semesterId = activeSem ? activeSem.id : "-";

      // Hitung Tugas Pending (Query tambahan biar realtime)
      const pendingTasks = await bot.db.prisma.task.count({
        where: { classId: kelas.id, status: "Pending" }
      });

      // 2. Susun Pesan
      let text = `🏫 *INFORMASI KELAS*\n`;
      text += `──────────────────\n`;
      text += `🏷️ Nama: *${kelas.name}*\n`;
      text += `📝 Deskripsi: ${kelas.description || "-"}\n`;
      text += `🆔 System ID: ${kelas.id}\n`;
      text += `\n`;
      text += `📅 *SEMESTER SAAT INI*\n`;
      text += `Status: ${semesterName}\n`;
      text += `ID Semester: ${semesterId}\n`;
      text += `📚 Jumlah Mapel: ${mapelCount}\n`;
      text += `\n`;
      text += `📊 *STATISTIK*\n`;
      text += `👥 Anggota: ${kelas._count.members} orang\n`;
      text += `📝 Tugas Pending: ${pendingTasks} tugas\n`;
      text += `🎲 Riwayat Grup: ${kelas._count.assignments} kali\n`;
      text += `──────────────────\n`;
      text += `_Gunakan #edit-class semester [ID] untuk pindah semester._`;

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error("Error info-class:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil data kelas." });
    }
  }
};