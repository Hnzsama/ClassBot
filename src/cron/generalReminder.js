// src/cron/generalReminder.js
const cron = require("node-cron");
const MS_IN_MINUTE = 60000;
const MS_IN_HOUR = 3600000;

const parseIntervalToMs = (intervalStr) => {
    const value = parseInt(intervalStr);
    const unit = intervalStr.slice(-1);
    if (unit === 'm') return value * MS_IN_MINUTE;
    if (unit === 'h') return value * MS_IN_MINUTE * 60;
    if (unit === 'd') return value * MS_IN_MINUTE * 60 * 24;
    return 0;
};

// --- LOGIKA 1: TASK REMINDER PRESISI (H-1 ke bawah) ---
async function checkPreciseTaskReminder(bot) {
    const nowMs = new Date().getTime();

    // Ambil tugas yang deadline-nya dalam 25 jam ke depan
    const pendingTasks = await bot.db.prisma.task.findMany({
        where: {
            status: 'Pending',
            deadline: { gt: new Date(nowMs), lt: new Date(nowMs + (25 * MS_IN_HOUR)) } 
        },
        include: { class: true, reminderStatuses: true }
    });

    let sentCount = 0;
    const slots = [
        { type: 'H-24', thresholdMs: 24 * MS_IN_HOUR },
        { type: 'H-12', thresholdMs: 12 * MS_IN_HOUR },
        { type: 'H-6', thresholdMs: 6 * MS_IN_HOUR },
        { type: 'H-1', thresholdMs: 1 * MS_IN_HOUR },
    ];

    for (const task of pendingTasks) {
        if (!task.class) continue;
        const groupId = task.class.mainGroupId; // Gunakan Main Group
        const timeRemainingMs = task.deadline.getTime() - nowMs;

        for (const slot of slots) {
            const statusEntry = task.reminderStatuses.find(s => s.reminderType === slot.type);
            
            // Logika Presisi: Kirim jika waktu sisa masuk jendela threshold (toleransi 1 menit)
            if (timeRemainingMs > slot.thresholdMs - MS_IN_MINUTE && timeRemainingMs <= slot.thresholdMs) {
                if (statusEntry && statusEntry.isSent) continue;

                // Format Waktu Sisa
                const days = Math.floor(timeRemainingMs / (24 * MS_IN_HOUR));
                const hours = Math.ceil((timeRemainingMs % (24 * MS_IN_HOUR)) / MS_IN_HOUR);
                const timeString = slot.type === 'H-1' 
                    ? `${Math.ceil(timeRemainingMs / MS_IN_MINUTE)} Menit` 
                    : `${days > 0 ? `${days} Hari ` : ''}${hours} Jam`;
                
                const deadlineStr = task.deadline.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: 'medium', timeStyle: 'short' });

                // --- DESIGN PESAN TUGAS ---
                const text = `╭── 🔥 *DEADLINE ALERT*
│ 🏫 *Kelas:* ${task.class.name}
│ 📚 *Mapel:* ${task.mapel}
│ 📝 *Judul:* ${task.judul}
│
│ ⏳ *Sisa Waktu:* ${timeString}
│ 🗓️ *Batas:* ${deadlineStr}
╰──────────────────
⚠️ _Segera kumpulkan sebelum terlambat!_
cc: *All Members*`;

                let participants = [];
                try {
                  const metadata = await bot.sock.groupMetadata(groupId);
                  participants = metadata.participants.map((p) => p.id);
                } catch (e) { /* silent fail */ }

                await bot.sock.sendMessage(groupId, { text, mentions: participants });

                // Update DB
                if (statusEntry) {
                  await bot.db.prisma.taskReminderStatus.update({ where: { id: statusEntry.id }, data: { isSent: true } });
                } else {
                  await bot.db.prisma.taskReminderStatus.create({ data: { taskId: task.id, reminderType: slot.type, isSent: true } });
                }
                sentCount++;
            }
        }
    }
    if (sentCount > 0) console.log(`[CRON-TASK] ${sentCount} precise reminders sent.`);
}

// --- LOGIKA UTAMA CRON ---
module.exports = (bot) => {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    try {
      // 1. Cek Task H-X
      await checkPreciseTaskReminder(bot); 
      
      // 2. Cek General Reminder
      const dueReminders = await bot.db.prisma.reminder.findMany({
        where: { isSent: false, waktu: { lte: now } },
        include: { class: true }
      });

      for (const rem of dueReminders) {
        if (!rem.class) continue;
        const groupId = rem.class.mainGroupId; 
        
        const timeStr = new Date(rem.waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit' });
        
        // --- DESIGN PESAN UMUM ---
        const text = `╭── 🔔 *PENGINGAT JADWAL*
│ 🏫 *Kelas:* ${rem.class.name}
│ ⏰ *Waktu:* ${timeStr} WIB
│
│ ❝ *${rem.pesan}* ❞
╰──────────────────
👤 _Oleh: @${rem.sender || "Admin"}_
cc: *All Members*`;

        let participants = [];
        try {
          const metadata = await bot.sock.groupMetadata(groupId);
          participants = metadata.participants.map((p) => p.id);
        } catch (e) { }

        await bot.sock.sendMessage(groupId, { text, mentions: participants });
        
        // Handle Repeat
        const isRepeatable = rem.repeatInterval && rem.repeatUntil;
        if (isRepeatable && rem.repeatUntil > now) {
            const intervalMs = parseIntervalToMs(rem.repeatInterval);
            const nextTime = new Date(rem.waktu.getTime() + intervalMs);
            if (nextTime < rem.repeatUntil) {
                await bot.db.prisma.reminder.update({ where: { id: rem.id }, data: { waktu: nextTime, isSent: false } });
                continue; 
            }
        }
        await bot.db.prisma.reminder.update({ where: { id: rem.id }, data: { isSent: true } });
      }

    } catch (err) { console.error("[CRON] Error:", err); }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] General Reminder (Per Menit) loaded.");
};