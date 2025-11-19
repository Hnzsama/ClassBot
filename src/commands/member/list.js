// commands/member/list.js (Ganti nama file sesuai file list kamu)
module.exports = {
  name: "#list-member",
  description: "Daftar member. Filter: [3 digit NIM]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    let nimFilter = args.find(arg => !isNaN(arg));

    try {
      // 1. Ambil ID Kelas dari Grup ini
      const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Admin harus ketik #add-class dulu." });

      // 2. Query Member berdasarkan classId
      const queryOptions = {
        where: { classId: kelas.id }, // <--- PENTING: Pakai ID Kelas
        orderBy: { nim: "asc" },
      };

      if (nimFilter) {
        queryOptions.where.nim = { endsWith: nimFilter };
      }

      const members = await bot.db.prisma.member.findMany(queryOptions);

      if (members.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ada data member di kelas ini." });
      }

      // Format Output
      let header = `👥 *MEMBER ${kelas.name}*\n`; // Ambil nama kelas dari DB
      if (nimFilter) header += `🔍 Filter: ...${nimFilter}\n`;
      header += `📊 Total: ${members.length}\n------------------\n`;

      const list = members.map((m, i) => `${i + 1}. ${m.nama} - ${m.nim}`).join("\n");

      await bot.sock.sendMessage(from, { text: header + list });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Error database." });
    }
  },
};