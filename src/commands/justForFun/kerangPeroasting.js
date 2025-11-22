// // src/commands/fun/kerang.js
// const SARCASM_LEVEL = 10;  // 1 (Sopan) - 10 (Sangat Pedas/Nyelekit)
// const ROASTING_LEVEL = 10 // 1 (Ramah) - 10 (Menghina Fisik/Logika)

// module.exports = {
//   name: "#kerang-ajaib",
//   description: "Bertanya pada Kerang Ajaib (AI Powered). Format: #kerang-ajaib [Pertanyaan]",
  
//   execute: async (bot, from, sender, args, msg, text) => {
//     const { sock, model } = bot;
//     const question = text.replace("#kerang-ajaib", "").trim();

//     if (!question) {
//       return sock.sendMessage(from, { text: "🐚 *Kerang Ajaib:* Tarik ulur talinya, lalu tanyakan sesuatu." });
//     }

//     await generateAnswer(bot, from, msg, question, null);
//   },

//   // --- EKSEKUSI LANJUTAN (REPLY) ---
//   handleReply: async (bot, from, msg, text) => {
//     const quotedMsg = msg.message.extendedTextMessage.contextInfo;
//     const previousBotResponse = quotedMsg.quotedMessage.conversation || quotedMsg.quotedMessage.extendedTextMessage.text;
//     const cleanPreviousContext = previousBotResponse.replace(/🐚.*💬:/s, "").trim();

//     await generateAnswer(bot, from, msg, text, cleanPreviousContext);
//   }
// };

// // --- FUNGSI HELPER AI ---
// async function generateAnswer(bot, from, msg, inputUser, contextLama) {
//   const { sock, model } = bot;
//   let answer = "";

//   if (model) {
//     try {
//       await sock.sendMessage(from, { react: { text: "🐚", key: msg.key } });

//       // Deteksi Topik Spesifik (MU)
//       const isMufc = /\b(mu|emyu|united|manchester|ten hag|maguire|rashford|onana|ggmu|tsunami trofi)\b/i.test(inputUser);

//       // Tentukan Tone berdasarkan Level
//       let toneInstruction = "";
//       if (SARCASM_LEVEL >= 8) {
//         toneInstruction = "Gunakan bahasa yang sangat kasar, meremehkan, to-the-point, dan menyakitkan hati.";
//       } else if (SARCASM_LEVEL >= 5) {
//         toneInstruction = "Gunakan bahasa gaul, sedikit menyebalkan, dan tengil.";
//       } else {
//         toneInstruction = "Gunakan bahasa yang sopan, misterius, dan tenang.";
//       }

//       let roastInstruction = "";
//       if (ROASTING_LEVEL >= 8) {
//         roastInstruction = "Jika pertanyaan bodoh, hina logikanya. Buat penanya merasa menyesal bertanya.";
//       } else if (ROASTING_LEVEL >= 5) {
//         roastInstruction = "Beri sindiran halus jika pertanyaan tidak bermutu.";
//       } else {
//         roastInstruction = "Jawab dengan bijak tanpa mengejek.";
//       }

//       let prompt = "";

//       if (isMufc) {
//         // --- MODE FANS MU (Dipengaruhi Level Sarkas) ---
//         prompt = `
// Kamu adalah Kerang Ajaib Fans MU Garis Keras.
// Pertanyaan user: "${inputUser}"

// Instruksi:
// 1. Bela MU mati-matian.
// 2. Serang fans klub lain (Liverpool/City/Arsenal) dengan level sarkasme ${SARCASM_LEVEL}/10.
// 3. Gunakan istilah bola (GGMU, Tsunami Trofi, Goa).
// 4. Maksimal 20 kata.
// `;
//       } else if (contextLama) {
//         // --- MODE FOLLOW UP ---
//         prompt = `
// Kamu adalah Kerang Ajaib.
// Konteks: Kamu menjawab "${contextLama}", user membalas "${inputUser}".

// Parameter Kepribadian:
// - Tingkat Sarkasme: ${SARCASM_LEVEL}/10
// - Tingkat Roasting: ${ROASTING_LEVEL}/10

// Instruksi:
// 1. ${toneInstruction}
// 2. ${roastInstruction}
// 3. Balas respon user dengan cerdas. Skakmat dia jika dia ngeyel.
// 4. Maksimal 10-15 kata.
// `;
//       } else {
//         // --- MODE PERTANYAAN BARU ---
//         prompt = `
// Kamu adalah Kerang Ajaib. Penentu Nasib Mutlak.
// Pertanyaan user: "${inputUser}"

// Parameter Kepribadian:
// - Tingkat Sarkasme: ${SARCASM_LEVEL}/10
// - Tingkat Roasting: ${ROASTING_LEVEL}/10

// Instruksi:
// 1. Analisis pertanyaan (Ya/Tidak/Kapan/Siapa).
// 2. ${toneInstruction}
// 3. ${roastInstruction}
// 4. Berikan jawaban pasti tapi dengan gaya sesuai level di atas.
// 5. Maksimal 10 kata.
// `;
//       }

//       const result = await model.generateContent(prompt);
//       const response = await result.response;
//       answer = response.text().trim();

//     } catch (e) {
//       console.error("Kerang AI Error:", e);
//     }
//   }

//   // Fallback jika AI mati
//   if (!answer) {
//     const defaultAnswers = ["TIDAK MUNGKIN.", "Coba tanya tembok.", "Mimpi.", "Makan dulu sana."];
//     answer = defaultAnswers[Math.floor(Math.random() * defaultAnswers.length)];
//   }

//   await sock.sendMessage(from, {
//     text: `🐚 *Kerang Ajaib Bersabda:*
    
// 💬: *${answer}*`,
//     quoted: msg 
//   });
// }