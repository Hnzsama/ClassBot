module.exports = {
  name: "#tag-all",
  alias: ["#tag"],
  description: "Tag all members. Options: --except, --only",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, owner } = bot;

    try {
      if (!from.endsWith("@g.us")) {
        await sock.sendMessage(from, {
          text: "❌ Perintah ini hanya untuk grup.",
        });
        return;
      }

      // Validasi Admin/Owner
      const isOwner = sender.includes(owner) || sender === owner;
      let metadata;
      try {
        metadata = await sock.groupMetadata(from);
      } catch (err) {
        return sock.sendMessage(from, { text: "❌ Gagal memuat info grup." });
      }

      let isAdmin = false;
      if (!isOwner) {
        const participant = metadata.participants.find((p) => p.id === sender);
        isAdmin = participant?.admin === "admin" || participant?.admin === "superadmin";

        if (!isAdmin) {
          await sock.sendMessage(from, {
            text: "⚠️ Hanya Admin yang boleh menggunakan fitur ini.",
          });
          return;
        }
      }

      const allMembers = metadata.participants.map((p) => p.id);
      const nativeMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      // Gabungkan argumen teks
      let fullText = args.join(" ");
      let finalMentions = [];
      let displayMessage = "📣 *PENGUMUMAN PENTING*";

      // Helper: Ekstrak nomor dari teks
      const extractJidsFromText = (segment) => {
        const matches = segment.match(/(\d{7,15})/g) || [];
        return matches.map(num => num.includes('@s.whatsapp.net') ? num : `${num}@s.whatsapp.net`);
      };

      // SKENARIO A: --only (Hanya tag orang tertentu)
      if (fullText.includes("--only")) {
        const parts = fullText.split("--only");
        displayMessage = parts[0].trim() || "📣 *PENGUMUMAN PENTING*";
        const targetSegment = parts[1];

        // Prioritas: Native Mention > Manual parsing
        if (nativeMentions.length > 0) {
          finalMentions = nativeMentions;
        } else {
          const textTargets = extractJidsFromText(targetSegment);
          finalMentions = textTargets.filter(id => allMembers.includes(id));
        }

        if (finalMentions.length === 0) {
          return sock.sendMessage(from, {
            text: "⚠️ Tidak ada target valid.\nPastikan nomor yang di-tag adalah anggota grup ini."
          });
        }

        // SKENARIO B: --except (Tag semua KECUALI...)
      } else if (fullText.includes("--except")) {
        const parts = fullText.split("--except");
        displayMessage = parts[0].trim() || "📣 *PENGUMUMAN PENTING*";

        let excluded = [];
        if (nativeMentions.length > 0) {
          excluded = nativeMentions;
        } else {
          excluded = extractJidsFromText(parts[1]);
        }

        // Filter: Semua member KECUALI yang ada di list excluded
        finalMentions = allMembers.filter(id => !excluded.includes(id));

        // SKENARIO C: Default (Tag Semua dengan custom pesan)
      } else {
        displayMessage = fullText || "📣 *PENGUMUMAN PENTING*";
        finalMentions = allMembers;
      }

      // Fallback jika pesan masih kosong
      if (!displayMessage) displayMessage = "📣 *PENGUMUMAN PENTING*";

      // Eksekusi Kirim
      await sock.sendMessage(from, {
        text: displayMessage,
        mentions: finalMentions
      });

    } catch (err) {
      console.error("Error #tag-all:", err);
      await sock.sendMessage(from, { text: "❌ Gagal melakukan tagging." });
    }
  },
};