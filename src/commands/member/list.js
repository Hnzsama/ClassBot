// src/commands/member/list.js
module.exports = {
  name: "#list-member",
  description: "Lihat daftar member. Filter: #list-member [3 digit NIM]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // Cek apakah ada argumen angka untuk filter (misal: 051)
    const nimFilter = args.find(arg => /^\d+$/.test(arg)); 

    try {
      // 1. Cek Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar di grup ini." });

      // 2. Query Database
      const queryOptions = {
        where: { classId: kelas.id },
        orderBy: { nim: "asc" }, // Urutkan berdasarkan NIM
      };

      // Terapkan filter jika user mengetik angka
      if (nimFilter) {
        queryOptions.where.nim = { endsWith: nimFilter };
      }

      const members = await bot.db.prisma.member.findMany(queryOptions);

      if (members.length === 0) {
        if (nimFilter) {
            return bot.sock.sendMessage(from, { text: `🔍 Tidak ditemukan member dengan akhiran NIM *...${nimFilter}*` });
        }
        return bot.sock.sendMessage(from, { text: "📂 Belum ada data member.\nGunakan `#add-member` untuk menambah." });
      }

      // 3. Susun Tampilan Keren
      let text = `📜 *DAFTAR MAHASISWA*\n`;
      text += `🏫 Kelas: *${kelas.name}*\n`;
      
      if (nimFilter) {
          text += `🔍 Filter NIM: *...${nimFilter}*\n`;
          text += `📊 Hasil: ${members.length} ditemukan\n`;
      } else {
          text += `👥 Total: ${members.length} Mahasiswa\n`;
      }
      
      text += `──────────────────────\n`;

      // Loop Member
      // Format: 1. 12345 - Nama Lengkap (Panggilan)
      const list = members.map((m, i) => {
        const num = i + 1;
        // NIM pakai monospace (tanda `)
        const nimFormatted = `\`${m.nim}\``; 
        // Nama
        let nameFormatted = m.nama;
        // Tambah panggilan jika ada
        if (m.panggilan) {
            nameFormatted += ` _(${m.panggilan})_`;
        }
        
        return `${num}. ${nimFormatted} - ${nameFormatted}`;
      }).join("\n");

      text += list;
      text += `\n──────────────────────\n`;
      
      // Footer Tips
      if (!nimFilter) {
          text += `💡 _Tips: Ketik #list-member [3 digit] untuk mencari NIM tertentu._`;
      }

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error("Error list-member:", e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  },
};