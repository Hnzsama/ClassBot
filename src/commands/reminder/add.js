// src/commands/reminder/add.js
module.exports = {
  name: "#reminder",
  description: "Pasang pengingat umum. Format: #reminder Pesan | YYYY-MM-DD HH:mm",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const content = text.replace("#reminder", "").trim();
    const parts = content.split("|").map(p => p.trim());

    if (parts.length < 2) {
      return bot.sock.sendMessage(from, { 
        text: "⚠️ Format Salah!\n\nContoh:\n`#reminder Bawa Baju Olahraga | 2025-10-20 07:00`\n`#reminder Zoom Meet Pak Budi | 2025-10-21 09:30`" 
      });
    }

    const [pesan, waktuStr] = parts;

    try {
      const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // Parse Waktu
      const waktu = new Date(waktuStr);
      if (isNaN(waktu.getTime())) {
        return bot.sock.sendMessage(from, { text: "❌ Format waktu salah. Gunakan: YYYY-MM-DD HH:mm" });
      }

      // Cek apakah waktu sudah lewat?
      if (waktu < new Date()) {
        return bot.sock.sendMessage(from, { text: "⚠️ Waktu tersebut sudah lewat." });
      }

      await bot.db.prisma.reminder.create({
        data: {
          pesan: pesan,
          waktu: waktu,
          classId: kelas.id,
          sender: sender.split("@")[0]
        }
      });

      await bot.sock.sendMessage(from, {
        text: `✅ *PENGINGAT DISIMPAN*\n\n🔔 Pesan: "${pesan}"\n⏰ Waktu: ${waktu.toLocaleString("id-ID")}\n\nBot akan mengirim pesan otomatis saat waktunya tiba.`
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal simpan reminder." });
    }
  }
};