// src/commands/reminder/delete.js
module.exports = {
  name: "#delete-reminder",
  description: "Hapus pengingat. Format: #delete-reminder [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    const id = parseInt(args[0]);
    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID angka." });

    try {
      // Cek kepemilikan kelas
      const reminder = await bot.db.prisma.reminder.findFirst({
        where: { id: id, class: { groupId: from } }
      });

      if (!reminder) return bot.sock.sendMessage(from, { text: "❌ Reminder tidak ditemukan." });

      await bot.db.prisma.reminder.delete({ where: { id } });
      await bot.sock.sendMessage(from, { text: "✅ Pengingat dihapus." });

    } catch (e) {
      console.error(e);
    }
  }
};