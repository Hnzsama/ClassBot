const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: "#transkrip",
  description: "Ubah Voice Note (VN) jadi teks. Reply VN dengan #transkrip",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;

    // 1. Validasi: Apakah ada pesan yang direply?
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quotedMessage || !quotedMessage.audioMessage) {
      return await sock.sendMessage(from, { 
        text: "⚠️ Reply sebuah Voice Note (VN) atau Audio dengan perintah `#transkrip`." 
      });
    }

    if (!model) {
      return await sock.sendMessage(from, { text: "❌ Fitur AI belum aktif." });
    }

    try {
      await sock.sendMessage(from, { react: { text: "🎧", key: msg.key } });

      // 2. Download Audio dari WhatsApp
      // Kita buat objek pesan palsu agar fungsi downloadMediaMessage bisa membacanya
      const fakeMsg = {
        key: {
            remoteJid: from,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
        },
        message: quotedMessage
      };

      const buffer = await downloadMediaMessage(
        fakeMsg,
        'buffer',
        { },
        { 
            logger: console, 
            reuploadRequest: sock.updateMediaMessage 
        }
      );

      // 3. Kirim ke Gemini AI
      // Ubah buffer ke Base64
      const audioBase64 = buffer.toString('base64');

      const prompt = `
      Tolong transkripsikan audio ini persis seperti apa yang diucapkan.
      Jika bahasa daerah, artikan ke bahasa Indonesia.
      Jika ada bagian yang tidak jelas, tandai dengan [suara tidak jelas].
      Buat dalam satu paragraf rapi.
      `;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "audio/ogg", // Format standar VN WhatsApp
            data: audioBase64
          }
        }
      ]);

      const response = await result.response;
      const textResult = response.text().trim();

      // 4. Kirim Hasil
      await sock.sendMessage(from, {
        text: `📝 *TRANSKRIPSI VN*\n\n"${textResult}"`,
        quoted: msg // Mereply perintah user
      });

    } catch (e) {
      console.error("Error Transkrip:", e);
      await sock.sendMessage(from, { text: "❌ Gagal mentranskrip audio." });
    }
  }
};