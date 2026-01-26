// src/commands/mapel/addAi.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { addSubjectsToDb } = require("./add");

module.exports = {
  name: "#mapel-ai",
  description: "Tambah mapel via AI (Teks/Foto).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!from.endsWith("@g.us")) return;
    
    const rawInput = text.replace("#mapel-ai", "").trim();
    
    // --- 1. DETEKSI GAMBAR (VISION) ---
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    let imagePart = null;
    let hasImage = false;

    if (quotedContext && quotedContext.quotedMessage?.imageMessage) {
        try {
            const buffer = await downloadMediaMessage(
                {
                    key: { remoteJid: from, id: quotedContext.stanzaId, participant: quotedContext.participant },
                    message: quotedContext.quotedMessage
                },
                'buffer',
                {}
            );
            
            imagePart = {
                inlineData: {
                    data: buffer.toString("base64"),
                    mimeType: "image/jpeg"
                }
            };
            hasImage = true;
        } catch (e) {
            console.error("Gagal download gambar:", e);
            return sock.sendMessage(from, { text: "❌ Gagal mengunduh gambar. Coba kirim ulang gambarnya." });
        }
    }

    // Validasi Input
    if (!rawInput && !hasImage) {
      return bot.sock.sendMessage(from, { 
            text: "⚠️ *AI MAPEL SCANNER*\n\nFitur ini bisa membaca *Foto Jadwal/KRS* atau *List Teks*.\n\n📈 *Cara Pakai (Foto):*\n1. Kirim/Reply foto jadwal.\n2. Ketik `#mapel+ai`\n\n📄 *Cara Pakai (Teks):*\nKetik `#mapel+ai mapel semester 1 IT`"
      });
    }

    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI belum diaktifkan oleh Admin Bot." });

    try {
      // --- 2. SETUP KELAS ---
      const kelas = await db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { semesters: { where: { isActive: true } } }
      });

      if (!kelas || kelas.semesters.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ada Semester Aktif. Silahkan setup semester dulu." });
      }
      const activeSem = kelas.semesters[0];

      // React Loading
      await sock.sendMessage(from, { react: { text: "👀", key: msg.key } });

      // --- 3. SYSTEM PROMPT ---
      const systemPrompt = `
      Peran: Asisten Administrasi Akademik.
      Tugas: Ekstrak/Generate daftar Nama Mata Kuliah (Subjects) dari input user.

      Instruksi:
      1. JIKA GAMBAR: Lakukan OCR, cari kolom "Mata Kuliah/Subject". Abaikan kode/dosen.
      2. JIKA LIST TEKS: Bersihkan simbol, ambil intinya.
      3. JIKA TOPIK: Sarankan mata kuliah yang relevan.

      OUTPUT WAJIB: JSON Array of Strings. Tanpa Markdown.
      Contoh: ["Matematika", "Fisika Dasar"]
      `;

      let parts = [];
      if (hasImage) {
          parts = [ systemPrompt, { text: `Input User: "${rawInput}"` }, imagePart ];
      } else {
          parts = [ systemPrompt, { text: `Input User: "${rawInput}"` } ];
      }

      // --- 4. EKSEKUSI AI ---
      const result = await model.generateContent(parts);
      const aiResponse = result.response.text();

      // --- 5. PARSING JSON ---
      let generatedNames = [];
      try {
        const jsonMatch = aiResponse.match(/\[.*?\]/s); 
        if (!jsonMatch) throw new Error("JSON Array not found");
        generatedNames = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("AI Parse Error:", aiResponse);
        return sock.sendMessage(from, { 
            text: "❌ *AI BINGUNG*\n\nGagal membaca data mata kuliah. Pastikan gambar tulisan jelas atau teks input lebih spesifik." 
        });
      }

      if (!Array.isArray(generatedNames) || generatedNames.length === 0) {
        return sock.sendMessage(from, { text: "📂 AI tidak menemukan nama mata kuliah apapun dari input tersebut." });
      }

      // --- 6. SIMPAN (Panggil fungsi manual) ---
      // Fungsi addSubjectsToDb akan mengirimkan respon sukses yang sudah kita styling sebelumnya
      return addSubjectsToDb(bot, from, sender, generatedNames, activeSem.id, kelas.name, true);

    } catch (e) {
      console.error("AI Mapel Error:", e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem AI." });
    }
  }
};