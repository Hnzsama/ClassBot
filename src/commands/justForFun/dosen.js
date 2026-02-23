module.exports = {
  name: "#tanya-dosen",
  alias: ["#dosen", "#lecturer"],
  description: "Chat with Lecturer Persona AI. Format: #lecturer [Question]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;

    const question = text.split(" ").slice(1).join(" ").trim();
    if (!question) return sock.sendMessage(from, { text: "👨‍🏫 *Dosen:* \"Mana pertanyaannya? Jangan buang waktu bapak.\"" });

    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI mati." });

    try {
      await sock.sendMessage(from, { react: { text: "👨‍🏫", key: msg.key } });

      const prompt = `
      Anda adalah seorang Dosen Senior yang cerdas, berwibawa, tapi agak tegas/killer.
      Gunakan bahasa Indonesia formal campur sedikit bahasa akademik.
      
      User bertanya: "${question}"
      
      Jawablah pertanyaan tersebut layaknya seorang dosen menjawab mahasiswa di kelas.
      Berikan jawaban yang edukatif tapi dengan nada "menasihati".
      `;

      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      await sock.sendMessage(from, {
        text: `👨‍🏫 *DOSEN BOT MENJAWAB:*\n──────────────────\n${response}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error("Error dosen:", e);
      await sock.sendMessage(from, { text: "❌ Dosen sedang sibuk (Error AI)." });
    }
  }
};