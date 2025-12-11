// src/commands/reminder/delete.js
module.exports = {
  name: "#delete-reminder",
  description: "Hapus pengingat (Khusus Admin). Format: #delete-reminder [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Parsing Input (Multiple IDs)
    // Ambil semua angka dari args (misal: #delete-reminder 12 13 14)
    const rawIds = args.map(arg => parseInt(arg)).filter(num => !isNaN(num));

    if (rawIds.length === 0) {
      return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID angka. Contoh: #delete-reminder 12 13" });
    }

    try {
      // 2. Cari Kelas (Sekali saja)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      const results = {
        deleted: [],
        failed: []
      };

      // 3. Loop Delete
      for (const id of rawIds) {
        // Cari Reminder
        const reminder = await bot.db.prisma.reminder.findFirst({
          where: { id: id, classId: kelas.id }
        });

        if (!reminder) {
          results.failed.push(`ID ${id} (Tidak ditemukan)`);
          continue;
        }

        // Cek Permission (Creator atau Owner)
        const isCreator = reminder.sender === sender.split('@')[0];
        const isOwner = sender === bot.owner;

        if (!isCreator && !isOwner) {
          results.failed.push(`ID ${id} (Bukan milikmu)`);
          continue;
        }

        // Hapus
        await bot.db.prisma.reminder.delete({ where: { id } });
        results.deleted.push(`ID ${id} ("${reminder.pesan}")`);
      }

      // 4. Kirim Laporan
      let responseText = "";

      if (results.deleted.length > 0) {
        responseText += `✅ *${results.deleted.length} Pengingat Dihapus:*\n`;
        responseText += results.deleted.map(s => `- ${s}`).join("\n");
      }

      if (results.failed.length > 0) {
        if (responseText) responseText += "\n\n";
        responseText += `❌ *${results.failed.length} Gagal:*\n`;
        responseText += results.failed.map(s => `- ${s}`).join("\n");
      }

      if (!responseText) responseText = "⚠️ Tidak ada aksi yang dilakukan.";

      await bot.sock.sendMessage(from, { text: responseText });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi error sistem saat menghapus reminder." });
    }
  }
};