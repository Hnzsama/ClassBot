// src/commands/member/list.js
module.exports = {
  name: "#list-member",
  description: "Daftar member. Filter: [3 digit NIM]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    const nimFilter = args.find(arg => !isNaN(arg)); // Ambil argumen angka

    try {
      // FIX: Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Query Member
      const queryOptions = {
        where: { classId: kelas.id },
        orderBy: { nim: "asc" },
      };

      if (nimFilter) {
        queryOptions.where.nim = { endsWith: nimFilter };
      }

      const members = await bot.db.prisma.member.findMany(queryOptions);

      if (members.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ada data member di kelas ini." });
      }

      // Format Output Keren
      let header = `👥 *MEMBER KELAS ${kelas.name}*\n`;
      if (nimFilter) header += `🔍 Filter NIM: ...${nimFilter}\n`;
      header += `📊 Total: ${members.length} Mahasiswa\n──────────────────\n`;

      const list = members.map((m, i) => `${i + 1}. ${m.nama} (${m.nim})`).join("\n");

      await bot.sock.sendMessage(from, { text: header + list });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Error database." });
    }
  },
};