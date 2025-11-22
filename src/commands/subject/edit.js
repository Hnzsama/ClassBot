module.exports = {
  name: "#edit-mapel",
  description: "Edit nama mapel. Format: #edit-mapel [ID Mapel] | [Nama Baru]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    
    const content = text.replace("#edit-mapel", "").trim();
    const parts = content.split("|").map(p => p.trim());

    if (parts.length < 2) {
      return bot.sock.sendMessage(from, { 
        text: "⚠️ Format Salah!\nContoh: `#edit-mapel 55 | Algoritma Lanjut`\n(Gunakan ID dari #list-mapel)" 
      });
    }

    const [idStr, newName] = parts;
    const targetId = parseInt(idStr);

    if (isNaN(targetId)) return bot.sock.sendMessage(from, { text: "❌ ID Mapel harus angka." });

    try {
      // 1. Cari Kelas & Semester Aktif
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { 
          semesters: { where: { isActive: true } } 
        }
      });

      if (!kelas || kelas.semesters.length === 0) return bot.sock.sendMessage(from, { text: "❌ Semester aktif tidak ditemukan." });
      const activeSem = kelas.semesters[0];

      // 2. Cari Mapel Target berdasarkan ID dan Semester (Security Check)
      const target = await bot.db.prisma.subject.findFirst({
          where: {
              id: targetId,
              semesterId: activeSem.id
          }
      });

      if (!target) {
        return bot.sock.sendMessage(from, { 
          text: `❌ Mapel dengan ID *${targetId}* tidak ditemukan di semester ini.` 
        });
      }

      // 3. Update
      await bot.db.prisma.subject.update({
        where: { id: targetId },
        data: { name: newName }
      });

      await bot.sock.sendMessage(from, { 
        text: `✏️ *UPDATE BERHASIL*\n\nID: ${targetId}\nDari: ~${target.name}~\nMenjadi: *${newName}*` 
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal edit mapel." });
    }
  }
};