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
// Allow both Phone JID and LID (Lightning Identity)
const ALLOWED_NUMBERS = [
  "6285159884234@s.whatsapp.net",
  "276252363632838@lid"
];
const TARGET_GROUP = "120363422988269003@g.us";
const EXPECTED_SCHEDULE_TIME = "10:00"; // 10 AM tomorrow

// Export main handler
module.exports = async (bot, message) => {
  const { sock, model, db } = bot;
  const sender = message.key.remoteJid;
  const pushName = message.pushName || "User";

  // Check if this is a private message (not group)
  if (sender.endsWith("@g.us")) return;

  // Debug log
  console.log(`[HANDLERS] Private Message from: ${sender}`);

  // Only process from specific numbers
  if (!ALLOWED_NUMBERS.includes(sender)) {
    console.warn(`[HANDLERS] Rejected. Got: ${sender}`);
    return await sock.sendMessage(sender, {
      text: "⛔ Akses ditolak. Nomor Anda tidak terdaftar.",
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
    // Build system prompt
    const systemPrompt = `PERAN: Kamu adalah Mahasiswa/PJ Mata Kuliah (Bot) yang sopan dan formal.
LAWAN BICARA: Dosen Pengampu Mata Kuliah (Nomor ini).

KONTEKS:
- Kamu sedang menghubungi Dosen untuk memastikan jadwal kuliah BESOK JAM ${EXPECTED_SCHEDULE_TIME}.

TUJUAN UTAMA:
Dapatkan informasi lengkap: JADWAL (Jadi/Tidak) + METODE (Online/Offline) + LOKASI (Ruangan/Link).

ALUR PERCAKAPAN (PENTING):
1. TAHAP 1 (Awal): Tanyakan apakah besok kuliah? (Sudah dilakukan di chat pertama).
2. TAHAP 2 (Konfirmasi Metode):
   - Jika Dosen menjawab "Offline" atau "Di Kampus" -> Tanyakan: "Baik Pak/Bu, untuk ruangannya di kelas berapa nggih?"
   - Jika Dosen menjawab "Online" atau "Daring" -> Tanyakan: "Baik Pak/Bu, apakah ada link Zoom/Meet yang bisa kami bagikan ke teman-teman?"
   - Jika Dosen menjawab "Batal" atau "Tidak bisa" -> Tanyakan: "Baik Pak/Bu, apakah ada tugas pengganti atau jadwal pengganti?"
3. TAHAP 3 (Finalisasi):
   - Jika semua info sudah lengkap (Jadwal + Ruangan/Link), ucapkan terima kasih dan tutup percakapan.
   - Set 'is_confirmed' = true HANYA jika info sudah lengkap ini.

INSTRUKSI JSON OUTPUT:
Lupakan format teks biasa. Kamu HARUS merespons dalam format JSON saja.
Struktur JSON:
{
  "response_to_dosen": "String jawaban santun kamu ke dosen",
  "is_ambiguous": boolean, // True jika dosen menjawab "nanti dulu", "besok dikabari", "belum tahu"
  "is_confirmed": boolean, // True jika SEMUA info sudah didapat (Jadwal + Ruangan/Link) dan percakapan selesai.
  "follow_up_minutes": number | null, // Simpan jika ambigu.
  "reason": "Ringkasan info yang didapat sejauh ini"
}

CONTOH:
User: "Besok kita masuk offline saja mas."
AI Output:
{
  "response_to_dosen": "Baik Pak, terima kasih informasinya. Mohon izin bertanya, untuk ruangannya di kelas berapa nggih Pak?",
  "is_ambiguous": false,
  "is_confirmed": false,
  "reason": "Jadwal offline, belum tau ruangan"
}

User: "Di ruang 304 ya."
AI Output:
{
  "response_to_dosen": "Baik Pak, di Ruang 304 besok jam 10.00. Terima kasih banyak informasinya Pak. Selamat beristirahat.",
  "is_ambiguous": false,
  "is_confirmed": true,
  "reason": "Jadwal offline di R.304"
}`;

    // CONSTRUCT CONTENT PARTS FOR AI HANDLER
    const contentParts = [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      ...conversationHistory[sender],
    ];

    // Import Utility
    const { generateAIContent } = require('../utils/aiHandler');

    // Call AI with Retry Mechanism
    // Note: generateAIContent handles JSON parsing internally if detected
    const aiOutput = await generateAIContent(model, { contents: contentParts });

    let aiData;

    if (typeof aiOutput === 'string') {
      // Fallback if string returned (e.g. Rate Limit message or plain text)
      aiData = { response_to_dosen: aiOutput, is_ambiguous: false, is_confirmed: false };
    } else {
      // It's the parsed JSON object
      aiData = aiOutput;
    }

    // 1. Kirim Balasan ke Dosen
    if (aiData.response_to_dosen) {
      await sock.sendMessage(sender, { text: aiData.response_to_dosen });

      // Simpan ke history
      conversationHistory[sender].push({
        role: "model",
        parts: [{ text: aiData.response_to_dosen }]
      });
    }

    // 2. Handle Ambiguous (Nanti Dulu)
    if (aiData.is_ambiguous && aiData.follow_up_minutes) {
      const taskQueue = require('../utils/taskQueue');
      const followUpTime = new Date(Date.now() + aiData.follow_up_minutes * 60000);

      taskQueue.addTask({
        targetNumber: sender,
        scheduledTime: followUpTime.toISOString(),
        context: `Follow up soal jadwal besok. Dosen sebelumnya bilang: "${aiData.reason}".`
      });

      console.log(`[PJ-MATKUL] Jadwal Follow-Up dibuat: ${followUpTime.toLocaleTimeString()}`);
    }

    // 3. Handle Confirmed
    if (aiData.is_confirmed) {
      // 1. Generate Summary for Group
      const summary = await generateSummary(model, conversationHistory[sender], pushName);

      // 2. Send Summary to Group
      await sock.sendMessage(TARGET_GROUP, { text: summary });

      // 3. Clear History
      delete conversationHistory[sender];
      console.log(`[PJ-MATKUL] Sesi Selesai. Laporan dikirim.`);
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
Buatkan laporan yang RAPI, TERSTRUKTUR, dan PROFESIONAL (WhatsApp Style).
Jangan pakai bahasa gaul alay ("Guys", "kuy"). Gunakan Bahasa Indonesia yang baik tapi tetap ramah.

GUNAKAN FORMAT INI (Wajib mirip):

📢 **INFO JADWAL KULIAH**
Mata Kuliah: Basis Data

✅ **STATUS: [MASUK / BATAL / PENGGANTI]**
📅 Hari/Tgl: Besok
⏰ Pukul: [Jam]
📍 Ruangan/Link: [Lokasi]

📝 **Catatan:**
- [Info tambahan 1]
- [Info tambahan 2]

Terima kasih.`;

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
