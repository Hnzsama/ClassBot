// src/commands/kelas/assignInput.js
module.exports = {
  name: "#assign-class",
  description: "Menetapkan grup ini sebagai grup input bot untuk kelas tertentu. Format: #assign-class [Class ID] [Main Group ID]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Validasi Jumlah Argumen (Wajib 2)
    if (args.length !== 2) {
        return await bot.sock.sendMessage(from, { 
            text: "⚠️ Format Salah. Harap berikan Class ID dan Main Group ID sebagai *dua* argumen terpisah.\nUsage: `#assign-class [ID] [JID]`" 
        });
    }

    const classId = parseInt(args[0]);
    const mainJid = args[1] || null;

    if (isNaN(classId)) {
        return await bot.sock.sendMessage(from, { text: "⚠️ Class ID harus berupa angka." });
    }
    
    // Check JID validity
    if (!mainJid || !mainJid.includes('@g.us')) {
        return await bot.sock.sendMessage(from, { text: "❌ Main Group ID tidak valid (Pastikan berakhiran @g.us)." });
    }
    

    try {
      // 2. Cek apakah Class ID valid dan Main JID cocok
      const kelas = await bot.db.prisma.class.findUnique({ 
        where: { id: classId, mainGroupId: mainJid } 
      });

      if (!kelas) {
        return bot.sock.sendMessage(from, { text: "❌ Class ID atau Main Group ID tidak ditemukan/tidak cocok." });
      }

      // 3. Cek apakah grup ini sudah terdaftar sebagai Main atau Input grup lain
      const exist = await bot.db.prisma.class.findFirst({
        where: {
          OR: [
            { mainGroupId: from },
            { inputGroupId: from }
          ]
        }
      });
      
      if (exist) {
          return await bot.sock.sendMessage(from, { 
              text: `❌ Gagal. Grup ini sudah terdaftar sebagai grup output atau grup input untuk kelas lain.` 
          });
      }

      // 4. Update Input Group ID pada Class yang sudah ada
      await bot.db.prisma.class.update({
        where: { id: classId },
        data: { inputGroupId: from }
      });

      // --- WORDING YANG LEBIH JELAS ---
      let reply = `🔗 *INTEGRASI BERHASIL!* 🔗\n\n`;
      reply += `Grup ini sekarang resmi menjadi *Komunitas Input* untuk:\n`;
      reply += `🏫 Kelas: *${kelas.name}*\n`;
      reply += `📢 Output Utama: *Grup Utama Kelas*\n`;
      reply += `\n✅ *Siap Digunakan!*\n`;
      reply += `Anda sekarang dapat mengetik perintah bot di sini (seperti #add-task, #info-class), dan notifikasi publik akan dikirim ke Grup Utama.`;
      
      await bot.sock.sendMessage(from, {
        text: reply,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal menautkan grup input. Cek kembali Class ID dan Main Group ID." });
    }
  }
};