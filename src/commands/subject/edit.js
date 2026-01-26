// src/commands/mapel/edit.js
module.exports = {
  name: "#subject-edit",
  alias: ["#mapel-edit"],
  description: "Edit subject name. Format: #subject-edit [ID] [New Name]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Validasi Input (Minimal 2 kata: ID dan Nama)
    if (args.length < 2) {
      return bot.sock.sendMessage(from, {
        text: "⚠️ *Format Salah (Gunakan Spasi)*\n\nContoh:\n`#edit-mapel 55 Algoritma Lanjut`\n\n_(Cek ID mapel di #list-mapel)_"
      });
    }

    // 2. Parsing Input (Spasi)
    const idStr = args[0];
    const newName = args.slice(1).join(" ").trim();
    const targetId = parseInt(idStr);

    if (isNaN(targetId)) return bot.sock.sendMessage(from, { text: "❌ ID Mapel harus berupa angka." });
    if (newName.length < 2) return bot.sock.sendMessage(from, { text: "⚠️ Nama mapel terlalu pendek." });

    try {
      // 3. Cari Kelas & Semester Aktif
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: {
          semesters: { where: { isActive: true } }
        }
      });

      if (!kelas || kelas.semesters.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ada semester aktif di kelas ini." });
      }

      const activeSem = kelas.semesters[0];

      // 4. Cari Mapel Target (Security Check)
      const target = await bot.db.prisma.subject.findFirst({
        where: {
          id: targetId,
          semesterId: activeSem.id
        }
      });

      if (!target) {
        return bot.sock.sendMessage(from, {
          text: `❌ Mapel ID *${targetId}* tidak ditemukan di *${activeSem.name}*.`
        });
      }

      // 5. Eksekusi Update
      await bot.db.prisma.subject.update({
        where: { id: targetId },
        data: { name: newName }
      });

      // 6. Respon Keren (Change Log Style)
      let reply = `✨ *DATA MATA KULIAH DIPERBARUI*\n`;
      reply += `──────────────────────\n`;
      reply += `🏫 Kelas: ${kelas.name}\n`;
      reply += `📅 Semester: ${activeSem.name}\n\n`;

      reply += `🔄 *Rincian Perubahan:*\n`;
      reply += `   🆔 ID Mapel: \`${targetId}\`\n`;
      reply += `   🔻 Semula: ~${target.name}~\n`;
      reply += `   ✅ Menjadi: *${newName}*\n`;

      reply += `──────────────────────\n`;
      reply += `👤 Oleh: @${sender.split("@")[0]}`;

      await bot.sock.sendMessage(from, {
        text: reply,
        mentions: [sender]
      });

    } catch (e) {
      console.error("Error edit-mapel:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengedit mata kuliah." });
    }
  }
};