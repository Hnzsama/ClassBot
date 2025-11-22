// src/commands/reminder/list.js
module.exports = {
  name: "#list-reminder",
  description: "Lihat pengingat yang akan datang.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // FIX: Gunakan Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // Ambil reminder yang BELUM terkirim
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

      let text = `🔔 *ANTREAN PENGINGAT (${reminders.length} Antrian)*\n────────────────\n`;
      
      reminders.forEach((r) => {
        const timeDisplay = new Date(r.waktu).toLocaleString("id-ID", { 
            timeZone: "Asia/Jakarta",
            dateStyle: 'medium', 
            timeStyle: 'short' 
        });

        let repeatStatus = "Sekali Saja";
        if (r.repeatInterval && r.repeatUntil) {
            const untilTime = r.repeatUntil.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", timeStyle: 'short' });
            repeatStatus = `Setiap ${r.repeatInterval} sampai ${untilTime}`;
        }

        text += `🆔 *ID: ${r.id}*\n`;
        text += `💬 ${r.pesan}\n`;
        text += `⏰ Waktu Kirim: ${timeDisplay} WIB\n`;
        text += `🔁 Frekuensi: ${repeatStatus}\n`;
        text += `👤 Oleh: _${r.sender || "-"}_ \n\n`;
      });

      text += `_Gunakan #delete-reminder [ID] atau #edit-reminder [ID] untuk kelola._`;
      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Error database." });
    }
  }
};