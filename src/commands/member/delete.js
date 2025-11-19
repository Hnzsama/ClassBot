// commands/member/delete.js
module.exports = {
  name: "#delete-member",
  description: "Hapus member. Format: #delete-member [3 digit NIM]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    if (args.length < 1) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan NIM akhir. Contoh: `#delete-member 001`" });

    const nimSuffix = args[0];

    try {
      // 1. Cek Kelas
      const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Cari Member di Kelas INI
      const candidates = await bot.db.prisma.member.findMany({
        where: {
          classId: kelas.id,
          nim: { endsWith: nimSuffix }
        }
      });

      if (candidates.length === 0) return bot.sock.sendMessage(from, { text: "❌ Member tidak ditemukan." });
      if (candidates.length > 1) return bot.sock.sendMessage(from, { text: "⚠️ NIM ambigu, ketik lebih lengkap." });

      const target = candidates[0];

      // 3. Hapus
      await bot.db.prisma.member.delete({
        where: { nim: target.nim }
      });

      await bot.sock.sendMessage(from, {
        text: `🗑️ *Member Dihapus*\nNIM: ${target.nim}\nNama: ${target.nama}\n\nOleh: @${sender.split("@")[0]}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus (Mungkin data terpakai di tugas)." });
    }
  },
};