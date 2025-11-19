// src/cron/taskReminder.js
const cron = require("node-cron");

module.exports = (bot) => {
  // Jadwal: Setiap jam 07:00 Pagi
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON-TASK] 🔄 Mengecek deadline tugas H-1...');
    
    try {
      const pendingTasks = await bot.db.prisma.task.findMany({
        where: { status: 'Pending', reminderSent: false },
        include: { class: true }
      });
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      let count = 0;

      for (const task of pendingTasks) {
        if (!task.class) continue;

        const deadlineDate = new Date(task.deadline);
        const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());

        // Cek H-1
        if (deadlineDay.getTime() === tomorrow.getTime()) {
          const groupId = task.class.groupId;
          let participants = [];

          // --- LOGIKA TAG ALL ---
          try {
            // Ambil metadata grup untuk mendapatkan ID semua member
            const metadata = await bot.sock.groupMetadata(groupId);
            participants = metadata.participants.map((p) => p.id);
          } catch (e) {
            console.error(`[CRON-TASK] Gagal fetch member grup ${groupId}:`, e.message);
          }

          // --- FORMAT PESAN KEREN ---
          const reminderText = `🚨 *PERINGATAN DEADLINE* 🚨
          
Halo warga kelas *${task.class.name}*! 👋
Jangan lupa, ada tugas yang harus dikumpulkan *BESOK*:

╭──────────────────
│ 📚 *Mapel:* ${task.mapel}
│ 📝 *Judul:* ${task.judul}
│ 🔗 *Link:* ${task.link && task.link !== "-" ? task.link : "_Tidak ada link_"}
│ ⏳ *Status:* H-1 (Besok)
╰──────────────────

_Mohon segera diselesaikan dan kumpulkan tepat waktu!_
cc: *All Members*`;

          // Kirim Pesan + Tag All
          await bot.sock.sendMessage(groupId, { 
            text: reminderText,
            mentions: participants // Array ID member untuk mentrigger notifikasi
          });

          // Update status DB
          await bot.db.prisma.task.update({
            where: { id: task.id },
            data: { reminderSent: true }
          });
          count++;
        }
      }
      
      if (count > 0) console.log(`[CRON-TASK] ${count} reminder dikirim.`);
      
    } catch (err) {
      console.error("[CRON-TASK] Error:", err);
    }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] Task Reminder (07:00) loaded.");
};