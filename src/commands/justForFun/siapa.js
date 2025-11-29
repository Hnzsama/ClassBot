module.exports = {
  name: "#siapa",
  description: "Pilih member acak. Format: #siapa [Pertanyaan]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const question = text.replace("#siapa", "").trim();
    
    if (!question) {
        return bot.sock.sendMessage(from, { text: "⚠️ Masukkan pertanyaannya.\nContoh: `#siapa yang belum mandi?`" });
    }

    try {
      // Ambil metadata grup untuk dapat list peserta
      const metadata = await bot.sock.groupMetadata(from);
      const participants = metadata.participants.map(p => p.id);

      // Pilih satu acak
      const randomParticipant = participants[Math.floor(Math.random() * participants.length)];

      // Kirim pesan dengan mention
      await bot.sock.sendMessage(from, {
          text: `🤔 *PERTANYAAN:* ${question}\n\n👉 Jawabannya adalah: @${randomParticipant.split("@")[0]}`,
          mentions: [randomParticipant]
      });

    } catch (e) {
      console.error("Error siapa command:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil data member grup." });
    }
  }
};