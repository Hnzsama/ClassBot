module.exports = {
  name: "#set-filter",
  description: "Aktifkan/Matikan filter kata kasar. Format: #set-filter [on/off]",
  execute: async (bot, from, sender, args, msg, text) => {
    // Validasi: Hanya admin grup atau Owner yang boleh
    const isOwner = sender.includes(bot.owner); // Sesuaikan logic owner Anda
    let isAdmin = false;
    if (!isOwner && from.endsWith("@g.us")) {
        const metadata = await bot.sock.groupMetadata(from);
        const participant = metadata.participants.find(p => p.id === sender);
        isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
    }

    if (!isOwner && !isAdmin) {
        return bot.sock.sendMessage(from, { text: "⚠️ Perintah ini hanya untuk Admin Grup." });
    }

    const mode = args[0] ? args[0].toLowerCase() : "";
    if (!["on", "off"].includes(mode)) {
        return bot.sock.sendMessage(from, { text: "⚠️ Format salah. Gunakan: `#set-filter on` atau `#set-filter off`" });
    }

    try {
      // 1. Cari Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Update Status Filter
      const isActive = mode === "on";
      await bot.db.prisma.class.update({
        where: { id: kelas.id },
        data: { enableFilter: isActive }
      });

      const statusText = isActive ? "✅ *AKTIF*" : "🔴 *NON-AKTIF*";
      const infoText = isActive 
        ? "Bot akan menghapus pesan yang mengandung kata kasar secara otomatis." 
        : "Bot tidak akan memfilter percakapan di grup ini.";

      await bot.sock.sendMessage(from, { 
          text: `🛡️ *FILTER KATA KASAR*\n\nStatus: ${statusText}\n\n${infoText}` 
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengubah pengaturan." });
    }
  }
};