// src/commands/reminder/edit.js
module.exports = {
  name: "#edit-reminder",
  description: "Edit pesan, waktu, atau interval pengingat. Format: #edit-reminder [ID] [field] [value]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    if (args.length < 3) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ Format salah. Contoh:\n`#edit-reminder 5 pesan Meeting pindah ke jam 10`\n`#edit-reminder 5 waktu 2025-11-22 10:00`" 
        });
    }

    const taskId = parseInt(args[0]);
    if (isNaN(taskId)) return bot.sock.sendMessage(from, { text: "❌ ID harus berupa angka." });

    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");
    const allowedFields = ['pesan', 'waktu', 'interval', 'sampai'];

    if (!allowedFields.includes(field)) {
        return bot.sock.sendMessage(from, { text: "❌ Field salah. Pilih: pesan, waktu, interval, atau sampai." });
    }

    try {
      // 1. Cari Kelas (Dual Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Cek Reminder
      const reminder = await bot.db.prisma.reminder.findFirst({
        where: { id: taskId, classId: kelas.id } // Filter by Class ID
      });

      if (!reminder) return bot.sock.sendMessage(from, { text: "❌ Reminder tidak ditemukan di kelas ini." });

      // ... (Logika Parsing Khusus tetap sama seperti sebelumnya) ...
      let updateData = {};
      let displayValue = newValue;

      if (field === 'waktu') {
        const isoStart = newValue.replace(" ", "T") + ":00+07:00";
        const newTime = new Date(isoStart);
        if (isNaN(newTime.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format waktu salah (YYYY-MM-DD HH:mm)." });
        updateData.waktu = newTime;
        updateData.isSent = false; 
        displayValue = newTime.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });
      } else if (field === 'interval') {
        const validIntervals = ['5m', '15m', '30m', '1h', '3h', '6h', '1d'];
        if (!validIntervals.includes(newValue)) return bot.sock.sendMessage(from, { text: `❌ Interval tidak valid.` });
        updateData.repeatInterval = newValue;
      } else if (field === 'sampai') {
        const isoUntil = newValue.replace(" ", "T") + ":00+07:00";
        const untilTime = new Date(isoUntil);
        if (isNaN(untilTime.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format waktu salah." });
        updateData.repeatUntil = untilTime;
        displayValue = untilTime.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });
      } else {
        updateData.pesan = newValue;
      }

      // 3. Eksekusi Update
      await bot.db.prisma.reminder.update({
        where: { id: taskId },
        data: updateData
      });

      await bot.sock.sendMessage(from, {
        text: `✏️ *PENGINGAT DIUPDATE*\n\nID: ${taskId}\nField: ${field.toUpperCase()}\nMenjadi: *${displayValue}*\n\nOleh: @${sender.split("@")[0]}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengedit pengingat." });
    }
  }
};