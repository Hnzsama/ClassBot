module.exports = {
  name: "#add-mapel",
  description: "Tambah mapel. Format: #add-mapel [Nama Mapel]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const namaMapel = text.replace("#add-mapel", "").trim();
    if (!namaMapel) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan nama mapel.\nContoh: `#add-mapel Matematika Diskrit`" });

    try {
      // 1. Cari Kelas & Semester Aktif
      const kelas = await bot.db.prisma.class.findUnique({
        where: { groupId: from },
        include: { semesters: { where: { isActive: true } } }
      });

      if (!kelas || kelas.semesters.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ada Semester Aktif. Pastikan kelas sudah di-setup." });
      }

      const activeSem = kelas.semesters[0];

      // 2. Cek Duplikat (Case Insensitive di sisi Code atau DB)
      const exist = await bot.db.prisma.subject.findFirst({
        where: { 
          semesterId: activeSem.id,
          name: namaMapel 
        }
      });

      if (exist) return bot.sock.sendMessage(from, { text: `❌ Mapel *${namaMapel}* sudah ada.` });

      // 3. Simpan
      await bot.db.prisma.subject.create({
        data: {
          name: namaMapel,
          semesterId: activeSem.id
        }
      });

      await bot.sock.sendMessage(from, { 
        text: `✅ Mapel *${namaMapel}* berhasil ditambahkan ke ${activeSem.name}.` 
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal tambah mapel." });
    }
  }
};