// src/cron/autoUpdateTask.js
const cron = require("node-cron");

module.exports = (bot) => {
  // Jadwal: Setiap Tengah Malam (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON-AUTO] 🔄 Cleaning overdue tasks...');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    try {
      const pendingTasks = await bot.db.prisma.task.findMany({
        where: { status: 'Pending' },
        include: { class: true }
      });

      let count = 0;
      for (const task of pendingTasks) {
        if (!task.class) continue;
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(0, 0, 0, 0);

        if (deadlineDate < now) {
          const groupId = task.class.mainGroupId;
          
          await bot.db.prisma.task.update({
            where: { id: task.id },
            data: { status: 'Selesai' } 
          });

          let participants = [];
          try {
            const metadata = await bot.sock.groupMetadata(groupId);
            participants = metadata.participants.map((p) => p.id);
          } catch (e) { }

          const deadlineStr = task.deadline.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: 'medium' });

          // --- DESIGN PESAN AUTO UPDATE ---
          const text = `╭── 🤖 *SISTEM OTOMATIS*
│ Tugas berikut telah melewati tenggat:
│
│ 📚 *Mapel:* ${task.mapel}
│ 📝 *Judul:* ${task.judul}
│ 🗓️ *Deadline:* ${deadlineStr}
│
│ 🔄 *Status Baru:* ✅ SELESAI (Auto)
╰──────────────────
_Status diubah otomatis oleh sistem._`;

          await bot.sock.sendMessage(groupId, { text, mentions: participants });
          count++;
        }
      }
      if (count > 0) console.log(`[CRON-AUTO] ${count} tasks marked as completed.`);

    } catch (err) { console.error("[CRON-AUTO] Error:", err); }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] Auto Update Task (00:00) loaded.");
};