// src/commands/reminder/addAi.js

// Utility untuk parsing waktu WIB
const parseWIB = (timeStr) => {
    if (!timeStr) return null;
    const isoStart = timeStr.replace(" ", "T") + ":00+07:00"; 
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

const validateInterval = (intervalStr) => {
    if (!intervalStr) return null;
    const regex = /^(\d+)([mhd])$/;
    const match = intervalStr.match(regex);
    if (!match) return null;
    const value = parseInt(match[1]);
    if (match[2] === 'm' && value < 1) return null;
    return intervalStr;
};

module.exports = {
  name: "#reminder-ai",
  description: "Pasang pengingat pintar via AI (Support Repeatable Logic).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!from.endsWith("@g.us")) return;
    
    const requestText = args.join(' ').trim();
    if (requestText.length < 5) {
      return bot.sock.sendMessage(from, { text: "⚠️ Deskripsi terlalu pendek." });
    }
    if (!model) {
      return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif." });
    }

    // --- FIX KRUSIAL: Dual Group Check ---
    const kelas = await db.prisma.class.findFirst({
        where: { 
          OR: [
            { mainGroupId: from },
            { inputGroupId: from }
          ]
        }
    });
    
    if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
    // -------------------------------------

    try {
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      const validIntervals = ['1m', '5m', '15m', '30m', '1h', '3h', '6h', '1d'];
      
      const options = { timeZone: 'Asia/Jakarta', hour12: false };
      const now = new Date();
      
      const currentParts = {
          year: now.toLocaleString('en-US', { ...options, year: 'numeric' }),
          month: now.toLocaleString('en-US', { ...options, month: '2-digit' }),
          day: now.toLocaleString('en-US', { ...options, day: '2-digit' }),
          hour: now.toLocaleString('en-US', { ...options, hour: '2-digit' }),
          minute: now.toLocaleString('en-US', { ...options, minute: '2-digit' }),
          weekday: now.toLocaleString('id-ID', { ...options, weekday: 'long' })
      };
      
      const dateContextIndo = `${currentParts.weekday}, ${currentParts.day}-${currentParts.month}-${currentParts.year}`;

      const systemPrompt = `
      Anda adalah Reminder Extractor. Tugas Anda adalah menganalisis input user dan mengekstrak detailnya ke format JSON.
      
      Konteks Waktu Saat Ini (WIB): ${dateContextIndo} Jam ${currentParts.hour}:${currentParts.minute}
      
      Aturan Output:
      1. WaktuMulai: WAJIB dihitung ke 'YYYY-MM-DD HH:mm'. Waktu ini HARUS di masa depan.
      2. Deteksi Pengulangan: Jika user meminta pengulangan, setel 'repeatInterval' (Format: angka+unit 'm/h/d'). Contoh: '1d', '3h', '10m'.
      3. RepeatUntil: WAJIB dihitung ke 'YYYY-MM-DD HH:mm'. Gunakan null jika tidak disebutkan.

      Input User: "${requestText}"

      Contoh Output JSON:
      { "pesan": "Isi pesan inti", "waktuMulai": "YYYY-MM-DD HH:mm", "repeatInterval": "1h", "repeatUntil": "2025-11-23 18:00" }
      `;

      const contents = [{ role: "user", parts: [{ text: systemPrompt }] }];
      const result = await model.generateContent({ contents });
      
      let jsonString = result.response.text().trim().replace(/```json|```/g, "").trim();
      
      const firstBracket = jsonString.indexOf("[");
      const lastBracket = jsonString.lastIndexOf("]");

      if (firstBracket !== -1 && lastBracket !== -1) {
          jsonString = jsonString.substring(firstBracket, lastBracket + 1);
      } else {
          const firstCurly = jsonString.indexOf("{");
          const lastCurly = jsonString.lastIndexOf("}");
          if (firstCurly !== -1 && lastCurly !== -1) {
              jsonString = `[${jsonString.substring(firstCurly, lastCurly + 1)}]`;
          }
      }

      let remindersData = [];
      try {
          remindersData = JSON.parse(jsonString);
      } catch (e) { throw new Error("Format data AI rusak."); }

      if (!Array.isArray(remindersData)) remindersData = [remindersData];

      let successCount = 0;
      let failCount = 0;
      let summaryText = "";

      for (const data of remindersData) {
          const waktuMulai = parseWIB(data.waktuMulai);
          const nowCheck = new Date();

          if (!waktuMulai || isNaN(waktuMulai.getTime()) || waktuMulai < new Date(nowCheck.getTime() - 300000)) {
              failCount++;
              continue; 
          }

          let repeatInterval = null;
          let repeatUntil = null;
          let originalInterval = data.repeatInterval;

          if (originalInterval) {
              repeatInterval = validateInterval(originalInterval);
              if (repeatInterval) {
                  if (data.repeatUntil) {
                      repeatUntil = parseWIB(data.repeatUntil);
                      if (!repeatUntil || repeatUntil <= waktuMulai) repeatUntil = null;
                  } else { repeatInterval = null; }
              } else { repeatInterval = null; }
          }

          await db.prisma.reminder.create({
            data: {
              pesan: data.pesan,
              waktu: waktuMulai,
              classId: kelas.id,
              sender: sender.split("@")[0],
              repeatInterval: repeatInterval,
              repeatUntil: repeatUntil
            }
          });

          const timeStr = waktuMulai.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour:'2-digit', minute:'2-digit' });
          summaryText += `✅ *${timeStr}*: ${data.pesan}`;
          if (repeatInterval) summaryText += ` (Tiap ${repeatInterval})`;
          summaryText += `\n`;
          
          successCount++;
      }

      if (successCount > 0) {
          let header = `✨ *${successCount} JADWAL DISIMPAN* ✨`;
          await sock.sendMessage(from, {
              text: `${header}\n\n${summaryText}`
          });
      } else {
          await sock.sendMessage(from, { text: "❌ Gagal. Waktu yang diminta sudah terlewat atau tidak dikenali." });
      }

    } catch (e) {
      console.error("Error reminder-ai:", e);
      await sock.sendMessage(from, { text: `❌ Error: ${e.message}` });
    }
  }
};