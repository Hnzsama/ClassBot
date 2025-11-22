// src/commands/reminder/add.js

// Utility: Parsing Waktu WIB
const parseWIB = (timeStr) => {
    const isoStart = timeStr.replace(" ", "T") + ":00+07:00";
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

// Utility: Parsing Interval Fleksibel (m, h, d)
const parseFlexibleIntervalToMs = (intervalStr) => {
    const unitMap = {
        'm': 60000,
        'h': 3600000,
        'd': 86400000,
    };
    
    if (typeof intervalStr !== 'string') return null;

    const value = parseInt(intervalStr);
    const unit = intervalStr.slice(-1).toLowerCase(); 

    if (isNaN(value) || value < 1 || !unitMap[unit]) return null; 
    if (unit === 'm' && value < 1) return null; // Min 1 menit
    
    return intervalStr; 
};


module.exports = {
  name: "#reminder",
  description: "Pasang pengingat umum. Format: #reminder Pesan | Mulai (YYYY-MM-DD HH:mm) | [Interval | Sampai (YYYY-MM-DD HH:mm)]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const content = text.replace("#reminder", "").trim();
    const parts = content.split("|").map(p => p.trim());

    // Validasi Input Minimal
    if (parts.length < 2) {
      const instructionText = `
⚠️ Format Salah! Harap lengkapi argumen.

*Format Dasar:*
\`#reminder [Pesan] | [Waktu Mulai]\`

*Format Berulang:*
\`#reminder [Pesan] | [Mulai] | [Interval] | [Sampai]\`

Contoh Sekali Saja:
\`#reminder Bawa Baju Olahraga | 2025-11-21 07:00\`

Contoh Berulang:
\`#reminder Tagih Kas | 2025-11-22 09:00 | 1d | 2025-12-01 10:00\`

(Unit Interval: \`m\`=menit, \`h\`=jam, \`d\`=hari. Minimal 1m.)
`;
      return bot.sock.sendMessage(from, { text: instructionText });
    }

    const [pesan, waktuStr] = [parts[0], parts[1]];
    const [intervalStr, untilStr] = [parts[2], parts[3]];

    try {
      // FIX: Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // Parse Waktu Mulai
      const waktuMulai = parseWIB(waktuStr);
      if (!waktuMulai) return bot.sock.sendMessage(from, { text: "❌ Format waktu mulai salah (YYYY-MM-DD HH:mm)." });
      if (waktuMulai < new Date()) return bot.sock.sendMessage(from, { text: "⚠️ Waktu mulai tersebut sudah lewat." });

      // Logic Repeatable
      let repeatInterval = null;
      let repeatUntil = null;
      let repeatText = "Sekali Saja";

      if (intervalStr && untilStr) {
        const validatedInterval = parseFlexibleIntervalToMs(intervalStr);
        if (!validatedInterval) return bot.sock.sendMessage(from, { text: `❌ Format interval tidak valid (e.g., 5m, 2h).` });

        const isoUntil = untilStr.replace(" ", "T") + ":00+07:00";
        repeatUntil = new Date(isoUntil);

        if (isNaN(repeatUntil.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format waktu akhir salah." });
        if (repeatUntil <= waktuMulai) return bot.sock.sendMessage(from, { text: "❌ Waktu akhir harus setelah waktu mulai." });

        repeatInterval = validatedInterval;
        repeatText = `Berulang setiap ${repeatInterval} sampai ${repeatUntil.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", timeStyle: 'short' })}`;
      }

      // Simpan
      await bot.db.prisma.reminder.create({
        data: {
          pesan: pesan,
          waktu: waktuMulai,
          classId: kelas.id,
          sender: sender.split("@")[0],
          repeatInterval: repeatInterval,
          repeatUntil: repeatUntil
        }
      });

      const displayTime = waktuMulai.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: 'full', timeStyle: 'short' });
      await bot.sock.sendMessage(from, {
        text: `✅ *PENGINGAT DISIMPAN*\n\n🔔 Pesan: "${pesan}"\n⏰ Mulai: ${displayTime} WIB\n🔁 Frekuensi: ${repeatText}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal simpan reminder." });
    }
  }
};