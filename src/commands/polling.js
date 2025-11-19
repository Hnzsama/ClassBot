// commands/polling.js
module.exports = {
  name: "#polling",
  description: "Membuat polling baru.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, polls } = bot;

    const fullArgs = args.join(" ");
    const parts = fullArgs.split("|").map((s) => s.trim());

    // Format: #polling Pertanyaan | Opsi 1 | Opsi 2
    if (parts.length < 3) {
      await sock.sendMessage(from, {
        text: "Format salah. Gunakan:\n*#polling [Pertanyaan] | [Opsi 1] | [Opsi 2] | [Opsi 3...]*",
      });
      return;
    }

    const question = parts[0];
    const options = parts.slice(1);

    let pollText = `📊 *POLLING BARU*\n\n*Pertanyaan:* ${question}\n\n*Opsi:*\n`;
    const optionLines = [];
    options.forEach((option, index) => {
      optionLines.push(`${index + 1}. ${option}`);
    });
    pollText += optionLines.join("\n");
    pollText += `\n\nBalas (reply) pesan ini dengan nomor pilihan Anda (1, 2, 3, ...).`;

    // Kirim pesan polling
    const pollMessage = await sock.sendMessage(from, { text: pollText });
    const pollId = pollMessage.key.id;

    // Siapkan struktur data untuk menyimpan suara
    const votesMap = new Map();
    options.forEach((_, index) => {
      votesMap.set(index, new Set()); // Gunakan Set untuk otomatis menangani duplikat vote
    });

    // Simpan data polling ke 'bot.polls' menggunakan ID pesan
    polls.set(pollId, {
      question,
      options,
      votes: votesMap,
      creator: sender,
      groupId: from,
    });

    console.log(`[POLL] Polling baru ${pollId} dibuat di grup ${from}`);
  },
};