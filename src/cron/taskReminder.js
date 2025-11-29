// src/cron/taskReminder.js
const cron = require("node-cron");
const MS_IN_HOUR = 3600000;

module.exports = (bot) => {
  // Jadwal: Setiap Awal Jam (00 menit)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON-TASK] 🔄 Hourly task check...');
    try {
      const nowMs = new Date().getTime();
      const pendingTasks = await bot.db.prisma.task.findMany({
        where: { status: 'Pending' },
        include: { class: true, reminderStatuses: true }
      });

      // Urutan Prioritas: 6 -> 12 -> 24
      const slots = [
          { type: 'H-6', thresholdMs: 6 * MS_IN_HOUR },
          { type: 'H-12', thresholdMs: 12 * MS_IN_HOUR },
          { type: 'H-24', thresholdMs: 24 * MS_IN_HOUR },
      ];

      for (const task of pendingTasks) {
        if (!task.class) continue;
        const timeRemainingMs = task.deadline.getTime() - nowMs;
        
        // Skip jika sudah lewat deadline
        if (timeRemainingMs <= 0) continue;

        const groupId = task.class.mainGroupId;

        for (const slot of slots) {
          // Logika Catch-Up: Jika sisa waktu <= threshold DAN belum dikirim
          if (timeRemainingMs <= slot.thresholdMs) {
            
            const statusEntry = task.reminderStatuses.find(s => s.reminderType === slot.type);
            if (statusEntry && statusEntry.isSent) continue;

            const hours = Math.ceil(timeRemainingMs / MS_IN_HOUR);
            const deadlineStr = task.deadline.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: 'medium', timeStyle: 'short' });
            const linkRow = (task.link && task.link !== '-' && task.link !== '') ? `\n│ 🔗 *Link:* ${task.link}` : '';

            const text = `╭── 📌 *STATUS TUGAS*
│ 🏫 *Kelas:* ${task.class.name}
│ 📚 *Mapel:* ${task.mapel}
│ 📝 *Judul:* ${task.judul}
│
│ ⏳ *Sisa Waktu:* ${hours} Jam (${slot.type})
│ 🗓️ *Deadline:* ${deadlineStr}${linkRow}
╰──────────────────
_Yuk dicicil, jangan ditunda!_
cc: *All Members*`;

            let participants = [];
            try {
              const metadata = await bot.sock.groupMetadata(groupId);
              participants = metadata.participants.map((p) => p.id);
            } catch (e) { }

            await bot.sock.sendMessage(groupId, { text, mentions: participants });

            if (statusEntry) {
              await bot.db.prisma.taskReminderStatus.update({ where: { id: statusEntry.id }, data: { isSent: true } });
            } else {
              await bot.db.prisma.taskReminderStatus.create({ data: { taskId: task.id, reminderType: slot.type, isSent: true } });
            }
            
            // Break agar tidak double notify di jam yang sama
            break; 
          }
        }
      }
    } catch (err) { console.error("[CRON-TASK] Error:", err); }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] Task Reminder (Hourly CatchUp) loaded.");
};