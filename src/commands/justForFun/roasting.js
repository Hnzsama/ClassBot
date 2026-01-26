module.exports = {
  name: "#roast",
  alias: ["#ledek"],
  description: "Roast your friend. Format: #roast [@tag]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model } = bot;
    if (!model) return;

    // Cek apakah ada yang ditag?
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetName = sender.split("@")[0]; // Default diri sendiri

    if (mentionedJid.length > 0) {
      targetName = mentionedJid[0].split("@")[0]; // Ambil orang yang ditag
    } else if (args.length > 0) {
      targetName = args.join(" "); // Atau ambil nama dari teks
    }

    try {
      await sock.sendMessage(from, { react: { text: "🔥", key: msg.key } });

      const prompt = `
      Kamu adalah komika Stand Up Comedy yang paling savage, pedas, dan lucu di Indonesia.
      Tugasmu adalah me-roasting (mengejek lucu) orang bernama: "${targetName}".
      
      Instruksi:
      1. Gunakan bahasa gaul/tongkrongan yang luwes.
      2. Buat asumsi lucu berdasarkan nama atau kelakuan anak muda jaman sekarang (misal: wibu, sadsad boy, beban keluarga, pecandu slot, atau kaum mendang-mending).
      3. Jangan rasis/SARA, tapi serang kepribadian atau nasibnya.
      4. Maksimal 3 kalimat pendek tapi nylekit (punchline).
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response.text();

      await sock.sendMessage(from, {
        text: `🔥 *ROASTING TIME* 🔥\n\nUntuk: @${targetName}\n\n"${response}"`,
        mentions: mentionedJid.length > 0 ? mentionedJid : [sender]
      });

    } catch (e) {
      console.error(e);
    }
  }
};