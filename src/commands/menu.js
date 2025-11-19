module.exports = {
  name: "#menu",
  description: "Menampilkan pilihan mapel",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, mapelOptions } = bot;

    const optionsText = mapelOptions
      .map((mapel, index) => `${index + 1}. ${mapel}`)
      .join("\n");

    await sock.sendMessage(from, {
      text: "Berikut adalah pilihan mapel yang tersedia:\n\n" + optionsText,
    });
  },
};