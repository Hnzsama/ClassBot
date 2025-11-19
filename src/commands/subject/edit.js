module.exports = {
  name: "#edit-mapel",
  description: "Edit nama mapel. Format: #edit-mapel [Nama Lama] | [Nama Baru]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    
    const content = text.replace("#edit-mapel", "").trim();
    const parts = content.split("|").map(p => p.trim());

    if (parts.length < 2) {
      return bot.sock.sendMessage(from, { 
        text: "⚠️ Format Salah!\nContoh: `#edit-mapel Algo | Algoritma Pemrograman`" 
      });
    }

    const [oldName, newName] = parts;

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
      const subjects = activeSem.subjects;

      // 2. Cari Mapel Target (Case Insensitive Search)
      const target = subjects.find(s => s.name.toLowerCase() === oldName.toLowerCase());

      if (!target) {
        return bot.sock.sendMessage(from, { 
          text: `❌ Mapel *"${oldName}"* tidak ditemukan di semester ini.\nCek nama di \`#list-mapel\`.` 
        });
      }

      // 3. Update
      await bot.db.prisma.subject.update({
        where: { id: target.id },
        data: { name: newName }
      });

      await bot.sock.sendMessage(from, { 
        text: `✏️ Mapel diubah:\n*${target.name}* ➝ *${newName}*` 
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal edit mapel." });
    }
  }
};