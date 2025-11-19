const { MAPEL_OPTIONS } = require("../utils/constants");

module.exports = {
  name: "#tambah-task",
  description: "Memulai sesi untuk menambah tugas baru",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, sessions } = bot;

    // Memulai sesi baru untuk sender
    sessions.set(sender, {
      step: 1,
      data: {},
    });

    const optionsText = MAPEL_OPTIONS.map(
      (mapel, index) => `${index + 1}. ${mapel}`
    ).join("\n");

    await sock.sendMessage(from, {
      text: "Silakan pilih mapel (ketik nomornya):\n\n" + optionsText,
    });
  },
};