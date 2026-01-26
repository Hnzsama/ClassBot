// src/commands/member/delete.js
module.exports = {
  name: "#member-delete",
  alias: ["#member-del"],
  description: "Delete member. Format: #member-delete [3 digit NIM]...",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // Filter input: hanya ambil yang angka
    const nimSuffixes = args.filter(arg => !isNaN(arg) && arg.length > 0);

    if (nimSuffixes.length === 0) {
      return bot.sock.sendMessage(from, {
        text: "⚠️ *Format Hapus Member*\n\nMasukkan akhiran NIM yang ingin dihapus (bisa banyak).\nContoh: `#delete-member 001 045 112`"
      });
    }

    try {
      // 1. Cek Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      const whereClauses = nimSuffixes.map(suffix => ({ nim: { endsWith: suffix } }));

      const candidates = await bot.db.prisma.member.findMany({
        where: {
          classId: kelas.id,
          OR: whereClauses
        },
        select: { nim: true, nama: true }
      });

      if (candidates.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ditemukan member dengan NIM tersebut." });
      }

      // 3. Eksekusi Delete Many
      const nimsToDelete = candidates.map(c => c.nim);

      const result = await bot.db.prisma.member.deleteMany({
        where: { nim: { in: nimsToDelete } }
      });

      // 4. Laporan Penghapusan
      let reply = `🗑️ *LAPORAN PENGHAPUSAN MEMBER*\n`;
      reply += `──────────────────────\n`;
      reply += `🏫 Kelas: ${kelas.name}\n`;
      reply += `❌ Total Dihapus: ${result.count} Orang\n`;
      reply += `──────────────────────\n`;

      // List nama yang dihapus
      candidates.forEach(c => {
        reply += `• ~${c.nama}~ (NIM: ${c.nim})\n`;
      });

      reply += `──────────────────────\n`;
      reply += `👤 Admin: @${sender.split("@")[0]}`;

      await bot.sock.sendMessage(from, {
        text: reply,
        mentions: [sender]
      });

    } catch (e) {
      console.error("Error delete-member:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal menghapus. Kemungkinan data member masih terhubung dengan Tugas/Absensi." });
    }
  },
};