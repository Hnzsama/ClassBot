// commands/hasilPoll.js
module.exports = {
  name: "#poll-result",
  alias: ["#hasil"],
  description: "Show polling result.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, polls } = bot;

    const quotedMsgId =
      msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

    if (!quotedMsgId) {
      await sock.sendMessage(from, {
        text: "Silakan reply pesan polling yang ingin Anda lihat hasilnya."
      });
      return;
    }

    const pollData = polls.get(quotedMsgId);

    if (!pollData) {
      await sock.sendMessage(from, {
        text: "Pesan yang Anda reply bukan polling aktif.",
      });
      return;
    }

    let resultsText = `📊 *HASIL POLLING SAAT INI*\n\n*Pertanyaan:* ${pollData.question}\n\n`;
    let totalVotes = 0;

    const optionLines = pollData.options.map((option, index) => {
      const voters = pollData.votes.get(index);
      const voteCount = voters.size;
      totalVotes += voteCount;
      return `${index + 1}. ${option} - *${voteCount} suara*`;
    });

    resultsText += optionLines.join("\n");
    resultsText += `\n\n*Total Suara Masuk:* ${totalVotes}`;

    await sock.sendMessage(from, { text: resultsText });
  },
};