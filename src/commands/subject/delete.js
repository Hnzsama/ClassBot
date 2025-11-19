module.exports = {
  name: "#delete-mapel",
  description: "Hapus mapel. Format: #delete-mapel [Nama Mapel] (--force)",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // Cek flag force (untuk paksa hapus)
    const isForce = text.includes("--force");
    const cleanText = text.replace("#delete-mapel", "").replace("--force", "").trim();

    if (!cleanText) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan nama mapel yang mau dihapus." });

    try {
      // 1. Cari Kelas & Semester Aktif
      const kelas = await bot.db.prisma.class.findUnique({
        where: { groupId: from },
        include: { 
          semesters: { 
            where: { isActive: true },
            include: { subjects: true }
          } 
        }
      });

      if (!kelas || kelas.semesters.length === 0) return bot.sock.sendMessage(from, { text: "❌ Semester aktif tidak ditemukan." });

      const activeSem = kelas.semesters[0];
      const target = activeSem.subjects.find(s => s.name.toLowerCase() === cleanText.toLowerCase());

      if (!target) {
        return bot.sock.sendMessage(from, { text: `❌ Mapel *"${cleanText}"* tidak ditemukan.` });
      }

      // 2. SAFETY CHECK: Cek Tugas Terkait
      // Hitung tugas di kelas ini yang nama mapelnya sama dengan mapel yg mau dihapus
      const relatedTasks = await bot.db.prisma.task.count({
        where: {
          classId: kelas.id,
          mapel: target.name // Tugas menyimpan string nama mapel
        }
      });

      // Jika ada tugas dan user belum pakai --force
      if (relatedTasks > 0 && !isForce) {
        return bot.sock.sendMessage(from, { 
          text: `⛔ *PERINGATAN!*\n\nAda *${relatedTasks} tugas* yang tersimpan dengan nama mapel *${target.name}*.\n\nJika dihapus, data mapel hilang tetapi tugas tetap ada (menjadi yatim).\n\nUntuk memaksa hapus, ketik:\n\`#delete-mapel ${cleanText} --force\`` 
        });
      }

      // 3. Hapus Mapel
      await bot.db.prisma.subject.delete({ where: { id: target.id } });
      
      let msgSuccess = `🗑️ Mapel *${target.name}* berhasil dihapus dari ${activeSem.name}.`;
      if (relatedTasks > 0) msgSuccess += `\n_(Catatan: ${relatedTasks} tugas terkait masih tersimpan)._`;

      await bot.sock.sendMessage(from, { text: msgSuccess });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus mapel." });
    }
  }
};