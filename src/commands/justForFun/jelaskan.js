module.exports = {
  name: "#jelaskan",
  description: "Minta penjelasan materi. Format: #jelaskan [Topik]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;
    
    const topic = text.replace("#jelaskan", "").trim();
    if (!topic) return sock.sendMessage(from, { text: "⚠️ Masukkan topik yang ingin dijelaskan.\nContoh: `#jelaskan apa itu pointer di C++`" });
    
    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI mati." });

    try {
      await sock.sendMessage(from, { react: { text: "💡", key: msg.key } });

      const prompt = `
      Anda adalah Tutor Akademik yang pandai menyederhanakan konsep rumit.
      Tugas: Jelaskan topik berikut secara ringkas, padat, dan mudah dimengerti mahasiswa.
      
      Topik: "${topic}"
      
      Berikan contoh konkret jika perlu.
      `;

      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      await sock.sendMessage(from, { 
          text: `💡 *PENJELASAN SINGKAT*\nTopik: _${topic}_\n──────────────────\n${response}`,
          mentions: [sender]
      });

    } catch (e) {
      console.error("Error jelaskan:", e);
      await sock.sendMessage(from, { text: "❌ Gagal memuat penjelasan." });
    }
  }
};