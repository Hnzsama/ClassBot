// src/commands/member/list.js
module.exports = {
  name: "#member-list",
  description: "Show member list. Filter: #member-list [Keywords...]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Cek Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar di grup ini." });

      // 2. Query Database
      const queryOptions = {
        where: { classId: kelas.id }, // Default: Only class members
        orderBy: { nim: "asc" },
      };

      // Terapkan Multi-Search
      if (args.length > 0) {
        // Construct OR conditions for each keyword
        // We want: (Field contains Keyword1) OR (Field contains Keyword2) ...
        // AND ensuring it's in the correct class.

        // Strategy: 
        // We want to find members where ANY of the keywords match ANY of the fields.
        // So we flatly map all keywords to all fields.
        // e.g. "Agus 001" -> (Name contains Agus OR Nim contains Agus) OR (Name contains 001 OR Nim contains 001)

        const orConditions = [];

        args.forEach(arg => {
          orConditions.push({ nim: { contains: arg } });
          orConditions.push({ nama: { contains: arg } });
          orConditions.push({ panggilan: { contains: arg } });
        });

        // Add to main where clause
        // Prisma: { classId: ..., AND: [ { OR: [...] } ] }
        queryOptions.where.AND = [
          { OR: orConditions }
        ];
      }

      const members = await bot.db.prisma.member.findMany(queryOptions);

      if (members.length === 0) {
        if (args.length > 0) {
          return bot.sock.sendMessage(from, { text: `🔍 Tidak ditemukan member dengan kata kunci: *${args.join(", ")}*` });
        }
        return bot.sock.sendMessage(from, { text: "📂 Belum ada data member.\nGunakan `#member` untuk menambah." });
      }

      // 3. Susun Tampilan Keren
      let text = `📜 *DAFTAR MAHASISWA*\n`;
      text += `🏫 Kelas: *${kelas.name}*\n`;

      if (args.length > 0) {
        text += `🔍 Filter: *${args.join(", ")}*\n`;
        text += `📊 Hasil: ${members.length} ditemukan\n`;
      } else {
        text += `👥 Total: ${members.length} Mahasiswa\n`;
      }

      text += `──────────────────────\n`;

      // Loop Member
      // Format: 1. 12345 - Nama Lengkap (Panggilan)
      const list = members.map((m, i) => {
        const num = i + 1;
        const nimFormatted = `\`${m.nim}\``;
        let nameFormatted = m.nama;
        if (m.panggilan) {
          nameFormatted += ` _(${m.panggilan})_`;
        }

        return `${num}. ${nimFormatted} - ${nameFormatted}`;
      }).join("\n");

      text += list;
      text += `\n──────────────────────\n`;

      // Footer Tips
      if (args.length === 0) {
        text += `💡 _Tips: Ketik #member-list [Nama/NIM] untuk mencari multiple members._`;
      }

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error("Error list-member:", e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  },
};