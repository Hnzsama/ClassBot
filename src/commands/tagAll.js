module.exports = {
  name: "#tag-all",
  description: "Mention semua anggota grup (Admin/Owner only)",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, owner } = bot;

    try {
      if (!from.endsWith("@g.us")) {
        await sock.sendMessage(from, {
          text: "Perintah ini hanya untuk grup.",
        });
        return;
      }

      const isOwner = sender === owner;
      let isAdmin = false;

      if (!isOwner) {
        const metadata = await sock.groupMetadata(from);
        const user = metadata.participants.find((p) => p.id === sender);
        isAdmin = user?.admin === "admin" || user?.admin === "superadmin";

        if (!isAdmin) {
          await sock.sendMessage(from, {
            text: "Fitur ini hanya untuk admin grup atau owner.",
          });
          return;
        }
      }

      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants.map((p) => p.id);

      const mentionText = participants
        .map((p) => `@${p.split("@")[0]}`)
        .join(" ");

      await sock.sendMessage(from, {
        text: `Halo semuanya!\n${mentionText}`,
        mentions: participants,
      });
    } catch (err) {
      console.error("Error #tag-all:", err);
      await sock.sendMessage(from, { text: "Gagal tag semua." });
    }
  },
};