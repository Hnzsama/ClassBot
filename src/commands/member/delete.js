// src/commands/member/delete.js
module.exports = {
  name: "#delete-member",
  description: "Hapus member. Format: #delete-member [3 digit NIM] [NIM Lain]...",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    // Filter input: hanya angka
    const nimSuffixes = args.filter(arg => !isNaN(arg) && arg.length > 0);

    if (nimSuffixes.length === 0) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan setidaknya satu NIM akhir. Contoh: `#delete-member 001 045`" });

    try {
      // FIX: Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Cari Kandidat (OR clause untuk multiple suffixes)
      const whereClauses = nimSuffixes.map(suffix => ({ nim: { endsWith: suffix } }));
      
      const candidates = await bot.db.prisma.member.findMany({
        where: {
          classId: kelas.id,
          OR: whereClauses
        },
        select: { nim: true, nama: true }
      });

      if (candidates.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ditemukan member yang cocok." });
      }

      // 3. Eksekusi Delete Many
      const nimsToDelete = candidates.map(c => c.nim);
      
      const result = await bot.db.prisma.member.deleteMany({
          where: { nim: { in: nimsToDelete } }
      });

      // 4. Konfirmasi
      const deletedNames = candidates.map(c => c.nama).join(', ');

      await bot.sock.sendMessage(from, {
        text: `🗑️ *${result.count} Member Dihapus*\n\n${deletedNames}\n\nOleh: @${sender.split("@")[0]}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus (Data mungkin terpakai di tempat lain)." });
    }
  },
};