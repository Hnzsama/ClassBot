// src/commands/reminder/delete.js
module.exports = {
  name: "#delete-reminder",
  description: "Hapus pengingat. Format: #delete-reminder [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    const id = parseInt(args[0]);
    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID angka." });

    try {
      // 1. Cari Kelas (Dual Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Cek Kepemilikan Reminder
      const reminder = await bot.db.prisma.reminder.findFirst({
        where: { id: id, classId: kelas.id } // Filter by Class ID
      });

      if (!reminder) return bot.sock.sendMessage(from, { text: "❌ Reminder tidak ditemukan di kelas ini." });

      // 3. Hapus
      await bot.db.prisma.reminder.delete({ where: { id } });
      await bot.sock.sendMessage(from, { text: `✅ Pengingat ID *${id}* ("${reminder.pesan}") berhasil dihapus.` });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus reminder." });
    }
  }
};