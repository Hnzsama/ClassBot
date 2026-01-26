/**
 * Private Chat Handler - Basis Data PJ
 * Lock conversation dari 081231511389
 * Gemini AI sebagai PJ Basis Data
 * 
 * Fitur:
 * - Menerima pesan dari nomor authorized
 * - Gemini AI berperan sebagai PJ Basis Data
 * - Bot initiates conversation at 5 PM daily
 */

const conversationHistory = {}; // Store conversation per user
const ALLOWED_NUMBER = "6285159884234@s.whatsapp.net";
const TARGET_GROUP = "120363421309923905@g.us";
const EXPECTED_SCHEDULE_TIME = "10:00"; // 10 AM tomorrow

// Export main handler
module.exports = async (bot, message) => {
  const { sock, model, db } = bot;
  const sender = message.key.remoteJid;
  const pushName = message.pushName || "User";

  // Check if this is a private message (not group)
  if (sender.endsWith("@g.us")) return;

  // Only process from specific number
  if (sender !== ALLOWED_NUMBER) {
    return await sock.sendMessage(sender, {
      text: "⛔ Percakapan ini hanya untuk nomor terdaftar (PJ Matkul).",
    });
  }

  if (!model) {
    return await sock.sendMessage(sender, {
      text: "❌ Fitur AI belum dikonfigurasi.",
    });
  }

  // Get message text
  const msgText =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    "";

  if (!msgText) return; // Ignore non-text messages

  // Initialize conversation history if not exists
  if (!conversationHistory[sender]) {
    conversationHistory[sender] = [];
  }

  // Add user message to history
  conversationHistory[sender].push({
    role: "user",
    parts: [{ text: msgText }],
  });

  try {
    // Show typing indicator
    await sock.sendPresenceUpdate("composing", sender);

    // Build system prompt
    const systemPrompt = `PERAN: Kamu adalah Mahasiswa/PJ Mata Kuliah (Bot) yang sopan dan formal.
LAWAN BICARA: Dosen Pengampu Mata Kuliah (Nomor ini).

KONTEKS:
- Kamu sedang menghubungi Dosen untuk memastikan jadwal kuliah BESOK JAM ${EXPECTED_SCHEDULE_TIME}.
- Kamu mewakili teman-teman sekelas.

TUJUAN:
1. Dapatkan kepastian apakah Dosen bisa mengajar besok jam ${EXPECTED_SCHEDULE_TIME}?
2. Jika bisa, tanyakan di ruangan mana atau online?
3. Jika tidak bisa, tanyakan apakah ada tugas pengganti atau jadwal ganti?
4. Jika sudah ada kepastian (Jadwal Fix / Batal / Tugas), akhiri percakapan dengan sopan dan ucapkan terima kasih.

GAYA BAHASA:
- Bahasa Indonesia baku, sangat sopan, dan hormat (khas mahasiswa ke dosen).
- Gunakan sapaan "Baik Pak/Bu", "Mohon maaf Pak/Bu", "Terima kasih Pak/Bu".
- Jangan kaku seperti robot, tapi tetap formal.

INSTRUKSI KHUSUS:
- Jika Dosen sudah memberikan kepastian akhir (misal: "Oke besok masuk", atau "Besok libur"), balas dengan ucapan terima kasih dan konfirmasi menutup percakapan.
- Contoh closing: "Baik Pak/Bu, terima kasih banyak atas informasinya. Saya akan sampaikan ke teman-teman sekelas. Selamat malam."
- Jika closing terdeteksi, tambahkan marker khusus di akhir response AI: "[[CONFIRMED]]" agar sistem bisa mengirim laporan ke grup kelas.`;

    // Call Gemini API with conversation history
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        ...conversationHistory[sender],
      ],
    });

    const aiResponse =
      response.response.candidates[0]?.content?.parts[0]?.text ||
      "Maaf, saya tidak dapat merespons saat ini.";

    // Remove marker from text sent to user
    const textToSend = aiResponse.replace("[[CONFIRMED]]", "").trim();

    // Add AI response to history
    conversationHistory[sender].push({
      role: "model",
      parts: [{ text: aiResponse }], // Keep marker in history for context if needed, or clean it. Better keep clean. 
    });
    // Actually, good to keep raw history, but we just push textToSend to be safe/natural.
    // Let's refix the history push.

    // Send response to user (Dosen)
    await sock.sendMessage(sender, {
      text: textToSend,
    });

    // Check if conversation is confirmed
    if (aiResponse.includes("[[CONFIRMED]]")) {
      // 1. Generate Summary for Group
      const summary = await generateSummary(
        model,
        conversationHistory[sender],
        pushName
      );

      // 2. Send Summary to Group
      const groupId = TARGET_GROUP;
      await sock.sendMessage(groupId, {
        text: summary,
      });

      // 3. Clear History
      delete conversationHistory[sender];
      console.log(`[PJ-MATKUL] Sesi dengan Dosen berakhir. Laporan dikirim ke ${groupId}`);
    }
  } catch (error) {
    console.error("Error in privateBasisData handler:", error);
  }
};

/**
 * Generate summary of conversation
 */
async function generateSummary(model, history, dosenName) {
  // Serialize history to text
  const serializedHistory = history.map(item => {
    const role = item.role === 'user' ? 'Dosen' : 'Saya (PJ)';
    const text = item.parts[0].text;
    return `${role}: ${text}`;
  }).join('\n');

  const summaryPrompt = `Buatkan Laporan Singkat untuk Grup WA Kelas (Mahasiswa).
  
SUMBER PERCAKAPAN:
${serializedHistory}

INSTRUKSI:
Berdasarkan percakapan di atas antara PJ dengan Dosen, buatkan laporan singkat:
1. Status Jadwal Besok (Jadi/Tidak/Ganti)
2. Jam & Ruangan (Jika ada)
3. Catatan/Tugas (Jika ada)

Format: Bahasa santai informatif untuk teman sekelas.
Contoh: "Guys, info dari Pak Dosen, besok kuliah Basis Data TETAP MASUK jam 10 ya di R.304. Jangan telat!"`;

  try {
     const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: summaryPrompt }],
        }
      ],
    });
    
    return response.response.candidates[0]?.content?.parts[0]?.text || "Info Jadwal: Cek history chat.";
  } catch (e) {
    console.error("Error generating summary:", e);
    return "⚠️ Gagal membuat ringkasan jadwal (API Error).";
  }
}
