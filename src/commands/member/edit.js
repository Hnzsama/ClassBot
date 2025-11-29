// src/commands/member/edit.js
module.exports = {
  name: "#edit-member",
  description: "Edit member. Format: #edit-member [3 digit NIM] [field] [value]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    // 1. Validasi Input
    if (args.length < 3) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ *Format Salah (Gunakan Spasi)*\n\nContoh:\n`#edit-member 001 nama Budi Santoso`\n`#edit-member 001 panggilan Budi`" 
        });
    }

    const nimSuffix = args[0];
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" "); // Gabung sisa argumen jadi satu string

    if (!["nama", "panggilan"].includes(field)) {
        return bot.sock.sendMessage(from, { text: "❌ Field salah. Hanya bisa edit 'nama' atau 'panggilan'." });
    }

    try {
      // 2. Cek Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 3. Cari Member (Berdasarkan akhiran NIM)
      const candidates = await bot.db.prisma.member.findMany({
        where: {
          classId: kelas.id,
          nim: { endsWith: nimSuffix }
        }
      });

      if (candidates.length === 0) return bot.sock.sendMessage(from, { text: `❌ Member dengan akhiran NIM *...${nimSuffix}* tidak ditemukan.` });
      
      // Cek Ambiguitas (Jika ada 2 orang dengan akhiran NIM sama, misal 1001 dan 2001)
      if (candidates.length > 1) {
          return bot.sock.sendMessage(from, { 
              text: `⚠️ NIM Ambigu. Ditemukan ${candidates.length} orang:\n${candidates.map(c => `- ${c.nama} (${c.nim})`).join('\n')}\n\nMohon ketik NIM lebih lengkap.` 
          });
      }

      const target = candidates[0];
      const oldValue = target[field] || "(Kosong)";

      // 4. Update Database
      await bot.db.prisma.member.update({
        where: { nim: target.nim },
        data: { [field]: newValue }
      });

      // 5. Respon Keren (Change Log)
      let reply = `✨ *DATA MEMBER DIPERBARUI*\n`;
      reply += `──────────────────────\n`;
      reply += `👤 Member: *${target.nama}*\n`;
      reply += `🆔 NIM: \`${target.nim}\`\n\n`;
      
      reply += `🔄 *Perubahan (${field.toUpperCase()}):*\n`;
      reply += `   🔻 Semula: ~${oldValue}~\n`;
      reply += `   ✅ Menjadi: *${newValue}*\n`;
      
      reply += `──────────────────────\n`;
      reply += `✍️ Oleh: @${sender.split("@")[0]}`;

      await bot.sock.sendMessage(from, {
        text: reply,
        mentions: [sender]
      });

    } catch (e) {
      console.error("Error edit-member:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengupdate data member." });
    }
  },
};