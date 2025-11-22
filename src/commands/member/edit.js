// src/commands/member/edit.js
module.exports = {
  name: "#edit-member",
  description: "Edit member. Format: #edit-member [3 digit NIM] [field] [value]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    if (args.length < 3) return bot.sock.sendMessage(from, { text: "⚠️ Format Salah! Contoh: `#edit-member 001 nama Budi`" });

    const nimSuffix = args[0];
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");

    if (!["nama", "panggilan"].includes(field)) return bot.sock.sendMessage(from, { text: "❌ Hanya bisa edit 'nama' atau 'panggilan'." });

    try {
      // FIX: Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Cari Member
      const candidates = await bot.db.prisma.member.findMany({
        where: {
          classId: kelas.id,
          nim: { endsWith: nimSuffix }
        }
      });

      if (candidates.length === 0) return bot.sock.sendMessage(from, { text: "❌ Member tidak ditemukan." });
      if (candidates.length > 1) return bot.sock.sendMessage(from, { text: "⚠️ NIM ambigu (banyak hasil), ketik lebih lengkap." });

      const target = candidates[0];

      // 3. Update (Gunakan NIM asli yang unik global)
      await bot.db.prisma.member.update({
        where: { nim: target.nim },
        data: { [field]: newValue }
      });

      await bot.sock.sendMessage(from, {
        text: `✏️ *Member Diupdate*\nNIM: ${target.nim}\n${field.toUpperCase()} -> *${newValue}*`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal edit." });
    }
  },
};