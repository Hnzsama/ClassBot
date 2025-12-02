module.exports = {
  name: "#info-class",
  description: "Menampilkan informasi detail kelas & semester aktif.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // Ambil Data Kelas + Semester Aktif + Count Relasi (FIX: Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: {
          OR: [
            { mainGroupId: from },
            { inputGroupId: from }
          ]
        },
        include: {
          semesters: {
            where: { isActive: true },
            include: {
              _count: { select: { subjects: true } }
            }
          },
          _count: {
            select: { 
              members: true, 
              tasks: true,
              assignments: true
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

      let text = `🏫 *INFORMASI KELAS*\n`;
      text += `──────────────────\n`;
      text += `🏷️ Nama: *${kelas.name}*\n`;
      text += `📝 Deskripsi: ${kelas.description || "-"}\n`;
      text += `🆔 ID Sistem: ${kelas.id}\n`;
      
      text += `\n*🔗 Status Koneksi Grup:*\n`;
      text += `📢 Grup Utama (Output): \`${kelas.mainGroupId}\`\n`; 
      text += `💬 Grup Komunitas (Input): \`${kelas.inputGroupId || '(Belum Diatur)'}\`\n`; 
      
      text += `\n📅 *SEMESTER SAAT INI*\n`;
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