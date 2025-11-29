// src/commands/reminder/add.js

// --- UTILITIES ---
// Parsing Waktu WIB (Format: YYYY-MM-DD HH:mm)
const parseWIB = (timeStr) => {
    if (!timeStr) return null;
    const isoStart = timeStr.replace(" ", "T") + ":00+07:00";
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

// Parsing Interval (m=menit, h=jam, d=hari)
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
    if (unit === 'm' && value < 1) return null; 
    return intervalStr; 
};

module.exports = {
  name: "#reminder",
  description: "Pasang pengingat manual. Format: #reminder Pesan, Waktu, [Interval], [Sampai]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // --- 1. PERBAIKAN DETEKSI MENTIONS ---
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
    // Cek `mentionedJid` (standar Baileys) atau `mentions` sebagai fallback
    const mentionedJids = contextInfo.mentionedJid || contextInfo.mentions || [];
    const targetMembers = mentionedJids.length > 0 ? mentionedJids.join(",") : null;
    // -------------------------------------

    // 2. Parsing Input (Split by Comma)
    const rawContent = text.replace("#reminder", "").trim();
    const parts = rawContent.split(",").map(p => p.trim());

    // 3. Validasi Input Minimal
    if (parts.length < 2 || !rawContent) {
      const instructionText = `
⚠️ *FORMAT PENGINGAT SALAH*

Gunakan koma ( , ) sebagai pemisah.

📌 *Format Sekali Jalan:*
\`#reminder [Pesan], [Tgl Jam]\`
Contoh:
\`#reminder Bawa Baju Olahraga, 2025-11-21 07:00\`

📌 *Format Berulang:*
\`#reminder [Pesan], [Mulai], [Jeda], [Sampai]\`
Contoh (Setiap 1 hari):
\`#reminder Tagih Kas, 2025-11-22 09:00, 1d, 2025-12-30 10:00\`

💡 _Bisa sambil tag orang tertentu untuk pengingat spesifik._
`;
      return bot.sock.sendMessage(from, { text: instructionText });
    }

    // Mapping Variabel
    const pesan = parts[0];
    const waktuStr = parts[1];
    const intervalStr = parts[2] || null; // Opsional
    const untilStr = parts[3] || null;    // Opsional

    try {
      // 4. Cek Validasi Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Grup ini belum terdaftar sebagai kelas." });

      // 5. Validasi Waktu Mulai
      const waktuMulai = parseWIB(waktuStr);
      if (!waktuMulai) {
          return bot.sock.sendMessage(from, { 
              text: `❌ *Format Waktu Salah*\n\nInput: "${waktuStr}"\nHarus: YYYY-MM-DD HH:mm\n\n_Pastikan tidak ada koma di dalam pesan._` 
          });
      }
      
      if (waktuMulai < new Date()) {
          return bot.sock.sendMessage(from, { text: "⚠️ Waktu mulai sudah lewat. Gunakan waktu masa depan." });
      }

      // 6. Logic Berulang (Repeatable)
      let repeatInterval = null;
      let repeatUntil = null;
      let repeatText = "Sekali Saja";

      if (intervalStr && untilStr) {
        const validatedInterval = parseFlexibleIntervalToMs(intervalStr);
        if (!validatedInterval) return bot.sock.sendMessage(from, { text: `❌ Interval salah. Gunakan format: 10m, 2h, atau 1d.` });

        // Parse Until
        repeatUntil = parseWIB(untilStr); 

        if (!repeatUntil) return bot.sock.sendMessage(from, { text: "❌ Format waktu 'Sampai' salah." });
        if (repeatUntil <= waktuMulai) return bot.sock.sendMessage(from, { text: "❌ Waktu 'Sampai' harus setelah waktu 'Mulai'." });

        repeatInterval = validatedInterval;
        repeatText = `Tiap ${repeatInterval} s/d ${repeatUntil.toLocaleString("id-ID", { day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit' })}`;
      }

      // 7. Simpan ke Database
      await bot.db.prisma.reminder.create({
        data: {
          pesan: pesan,
          waktu: waktuMulai,
          classId: kelas.id,
          sender: sender.split("@")[0], // Simpan nomor saja
          repeatInterval: repeatInterval,
          repeatUntil: repeatUntil,
          targetMembers: targetMembers // Simpan list tag
        }
      });

      // 8. Respon Sukses Estetik
      const displayTime = waktuMulai.toLocaleString("id-ID", { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: "Asia/Jakarta"
      });

      // --- LOGIKA DISPLAY TAGGING DI REPLY ---
      let tagInfo = "Semua Member";
      let mentionsToReply = [sender]; // Sender wajib ditag di konfirmasi

      if (targetMembers) {
          const targets = targetMembers.split(",");
          // Gabungkan ke array mentions agar nama mereka biru di chat
          mentionsToReply = mentionsToReply.concat(targets);
          // Buat string display: @628xxx, @628xxx
          tagInfo = targets.map(id => `@${id.split('@')[0]}`).join(", ");
      }

      let reply = `🔔 *PENGINGAT DIJADWALKAN*\n`;
      reply += `────────────────────\n`;
      reply += `📝 Pesan: "${pesan}"\n`;
      reply += `⏰ Waktu: *${displayTime} WIB*\n`;
      reply += `👥 Target: ${tagInfo}\n`;
      reply += `🔁 Status: ${repeatText}\n`;
      reply += `────────────────────\n`;
      
      if (targetMembers) {
          reply += `💡 _Bot hanya akan men-tag orang yang dimention di atas._`;
      } else {
          reply += `💡 _Bot akan men-tag semua member saat waktunya tiba._`;
      }

      await bot.sock.sendMessage(from, {
        text: reply,
        mentions: mentionsToReply // PENTING: Array JID agar tag berfungsi
      });

    } catch (e) {
      console.error("Error reminder add:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal menyimpan pengingat. Terjadi kesalahan sistem." });
    }
  }
};