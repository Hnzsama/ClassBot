// src/commands/fun/kerang.js

// --- KONFIGURASI STATE ---
let SARCASM_LEVEL = 8;  // 1 (Sopan) - 10 (Sangat Pedas/Nyelekit)
let ROASTING_LEVEL = 8; // 1 (Ramah) - 10 (Menghina Fisik/Logika)
const VIP_ID = "276252363632838"; // ID Kamu (Hanya untuk ON/OFF dan Level)
let IS_ACTIVE = true; // Status ON/OFF Kerang Ajaib
// ----------------------------------------------------

module.exports = {
  name: "#kerang-ajaib",
  description: "Bertanya pada Kerang Ajaib (AI Powered). Format: #kerang-ajaib [Pertanyaan]",
  
  // --- EKSEKUSI UTAMA (COMMAND) ---
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;

    // 1. CEK VIP dan TOGGLE STATE (ON/OFF atau Level)
    const isVip = sender.includes(VIP_ID);
    const arg1 = args[0] ? args[0].toLowerCase() : "";
    const level = parseInt(args[1]);

    // Logika pesan dinamis
    let onMsg, offMsg;
    if (SARCASM_LEVEL >= 8) {
      onMsg = "DIAM! Raja telah kembali. Siap-siap kena mental lagi.";
      offMsg = "Capek gua! Jangan panggil-panggil kalau gak penting.";
    } else if (SARCASM_LEVEL >= 5) {
      onMsg = "Oke, gua balik. Siapa yang kangen?";
      offMsg = "Gua off bentar ya, jangan berisik.";
    } else {
      onMsg = "Saya aktif dan siap melayani.";
      offMsg = "Saya istirahat sebentar, sampai jumpa.";
    }


    if (isVip) {
      // --- A. Logic ON/OFF ---
      if (arg1 === "on" || arg1 === "off") {
        if (arg1 === "on") {
          IS_ACTIVE = true;
          return sock.sendMessage(from, { text: `🐚 *Kerang Ajaib:* ${onMsg}` });
        } else {
          IS_ACTIVE = false;
          return sock.sendMessage(from, { text: `🐚 *Kerang Ajaib:* ${offMsg}` });
        }
      }
      
      // --- B. Logic UBAH LEVEL ---
      if (arg1 === "sarcasm" || arg1 === "roasting") {
        if (isNaN(level) || level < 1 || level > 10) {
          return sock.sendMessage(from, { text: "⚠️ Level harus angka antara 1 sampai 10." });
        }

        if (arg1 === "sarcasm") {
          SARCASM_LEVEL = level;
          return sock.sendMessage(from, { text: `✅ Tingkat SARCASM diubah menjadi *${level}* (Mode: ${level >= 8 ? 'Savage' : level >= 5 ? 'Tengil' : 'Sopan'}).` });
        } else { // roasting
          ROASTING_LEVEL = level;
          return sock.sendMessage(from, { text: `✅ Tingkat ROASTING diubah menjadi *${level}* (Mode: ${level >= 8 ? 'Nyelekit' : level >= 5 ? 'Sindiran' : 'Ramah'}).` });
        }
      }
    }
    // END OF VIP CHECKS

    // 2. CEK STATUS AKTIF
    if (!IS_ACTIVE) {
      return sock.sendMessage(from, { text: "💤 _(Kerang Ajaib sedang dimatikan oleh Admin)_" });
    }

    const question = text.replace("#kerang-ajaib", "").trim();
    if (!question) {
      return sock.sendMessage(from, { text: "🐚 *Kerang Ajaib:* Tarik ulur talinya, lalu tanyakan sesuatu." });
    }

    await generateAnswer(bot, from, msg, question, null);
  },

  // --- EKSEKUSI LANJUTAN (REPLY) ---
  handleReply: async (bot, from, msg, text) => {
    if (!IS_ACTIVE) return; 

    const quotedMsg = msg.message.extendedTextMessage.contextInfo;
    const previousBotResponse = quotedMsg.quotedMessage.conversation || quotedMsg.quotedMessage.extendedTextMessage.text;
    const cleanPreviousContext = previousBotResponse.replace(/🐚.*💬:/s, "").trim();

    await generateAnswer(bot, from, msg, text, cleanPreviousContext);
  }
};

// --- FUNGSI HELPER AI ---
async function generateAnswer(bot, from, msg, inputUser, contextLama) {
  const { sock, model } = bot;
  let answer = "";

  if (model) {
    try {
      await sock.sendMessage(from, { react: { text: "🐚", key: msg.key } });

      let prompt = "";
      
      // 1. CEK TOPIK MU
      const isMufc = /\b(mu|emyu|united|manchester|ten hag|maguire|rashford|onana|ggmu|tsunami trofi)\b/i.test(inputUser);

      // Tentukan Tone berdasarkan Level Dinamis
      let toneInstruction = SARCASM_LEVEL >= 8 
        ? "Gunakan bahasa yang sangat kasar, meremehkan, to-the-point, dan menyakitkan hati."
        : SARCASM_LEVEL >= 5 
          ? "Gunakan bahasa gaul, sedikit menyebalkan, dan tengil."
          : "Gunakan bahasa sopan dan misterius.";

      let roastInstruction = ROASTING_LEVEL >= 8 
        ? "Jika pertanyaan bodoh, hina logikanya. Buat penanya merasa menyesal bertanya."
        : ROASTING_LEVEL >= 5 
          ? "Beri sindiran halus jika pertanyaan tidak bermutu."
          : "Jawab dengan bijak tanpa mengejek.";

      if (isMufc) {
        // --- MODE FANS MU GARIS KERAS ---
        prompt = `
Kamu adalah Kerang Ajaib Fans MU Garis Keras.
Pertanyaan: "${inputUser}"
Tingkat Sarkasme: ${SARCASM_LEVEL}/10.

Instruksi:
1. Jawab user dengan kacamata fans MU sejati.
2. Bela MU mati-matian atau serang klub lain.
3. Maksimal 20 kata.
`;
      } else if (contextLama) {
        // --- MODE NORMAL: FOLLOW-UP ---
        prompt = `
Kamu adalah 'Kerang Ajaib'.
Konteks: Kamu menjawab "${contextLama}", user membalas "${inputUser}".

Parameter Kepribadian:
- Tingkat Sarkasme: ${SARCASM_LEVEL}/10
- Tingkat Roasting: ${ROASTING_LEVEL}/10

Instruksi:
1. Balas respon user secara RELEVAN tapi singkat.
2. Jika user ngeyel, skakmat dia.
3. Maksimal 15 kata.
4. ${toneInstruction}
5. ${roastInstruction}
`;
      } else {
        // --- MODE NORMAL: PERTANYAAN BARU ---
        prompt = `
Kamu adalah 'Kerang Ajaib'. Penentu nasib yang tahu segalanya.
Pertanyaan user: "${inputUser}"

Parameter Kepribadian:
- Tingkat Sarkasme: ${SARCASM_LEVEL}/10
- Tingkat Roasting: ${ROASTING_LEVEL}/10

Instruksi:
1. Analisis pertanyaan user.
2. Berikan jawaban yang PASTI dan RELEVAN.
3. Maksimal 10 kata.
4. ${toneInstruction}
5. ${roastInstruction}
`;
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      answer = response.text().trim();

    } catch (e) {
      console.error("Kerang AI Error:", e);
    }
  }

  // Fallback jika AI mati
  if (!answer) {
    const defaultAnswers = ["TIDAK MUNGKIN.", "Coba tanya tembok.", "Mimpi.", "Makan dulu sana."];
    answer = defaultAnswers[Math.floor(Math.random() * defaultAnswers.length)];
  }

  await sock.sendMessage(from, {
    text: `🐚 *Kerang Ajaib Bersabda:*
    
💬: *${answer}*`,
    quoted: msg 
  });
}