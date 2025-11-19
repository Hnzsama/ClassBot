// commands/member/add.js
module.exports = {
  name: "#add-member",
  description: "Tambah member. Format: #add-member NIM | Nama | Panggilan",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const rawContent = text.replace("#add-member", "").trim();
    const parts = rawContent.split("|").map((p) => p.trim());

    if (parts.length < 2) {
      return await bot.sock.sendMessage(from, { text: "⚠️ Format: `#add-member NIM | Nama | Panggilan`" });
    }
    const [nim, nama, panggilan] = parts;

    try {
      // 1. Cek Kelas
      const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan #add-class dulu." });

      // 2. Cek NIM Duplikat
      const exist = await bot.db.prisma.member.findUnique({ where: { nim: nim } });
      if (exist) return bot.sock.sendMessage(from, { text: `❌ NIM ${nim} sudah ada.` });

      // 3. Buat Member (Hubungkan ke classId)
      await bot.db.prisma.member.create({
        data: {
          nim, nama, panggilan,
          classId: kelas.id // <--- Relasi disini
        },
      });

      await bot.sock.sendMessage(from, {
        text: `✅ *Member Ditambahkan*\nKe Kelas: ${kelas.name}\nNIM: ${nim}\nNama: ${nama}\n\nOleh: @${sender.split("@")[0]}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal tambah member." });
    }
  },
};