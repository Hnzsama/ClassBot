// src/commands/reminder/list.js
module.exports = {
  name: "#list-reminder",
  description: "Lihat pengingat yang akan datang.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
      if (!kelas) return;

      // Ambil reminder yang BELUM terkirim (isSent: false)
      const reminders = await bot.db.prisma.reminder.findMany({
        where: { 
          classId: kelas.id,
          isSent: false 
        },
        orderBy: { waktu: 'asc' }
      });

      if (reminders.length === 0) {
        return bot.sock.sendMessage(from, { text: "🔕 Tidak ada pengingat aktif." });
      }

      let text = `🔔 *ANTREAN PENGINGAT*\n────────────────\n`;
      reminders.forEach((r) => {
        const time = new Date(r.waktu).toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });
        text += `🆔 *ID: ${r.id}*\n`;
        text += `📅 ${time}\n`;
        text += `💬 "${r.pesan}"\n`;
        text += `👤 _Oleh: ${r.sender || "-"}_ \n\n`;
      });

      text += `_Gunakan #delete-reminder [ID] untuk menghapus._`;
      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error(e);
    }
  }
};