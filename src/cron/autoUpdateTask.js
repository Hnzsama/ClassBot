// src/cron/autoUpdateTask.js
const cron = require("node-cron");

module.exports = (bot) => {
  // 🔄 JADWAL: Cek SETIAP MENIT (* * * * *)
  // Agar akurat pas deadline (Real-time)
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    try {
      // 1. Cari Tugas Pending yang Deadline-nya SUDAH LEWAT (atau pas sekarang)
      const dueTasks = await bot.db.prisma.task.findMany({
        where: {
          status: 'Pending',
          deadline: { lte: now } // Less than or Equal to Now
        },
        include: { class: true }
      });

      if (dueTasks.length === 0) return;

      console.log(`[CRON-AUTO] 🔄 Closing ${dueTasks.length} tasks as 'Selesai'...`);

      for (const task of dueTasks) {
        if (!task.class) continue;

        const groupId = task.class.mainGroupId;

        // 2. Update Status jadi 'Selesai'
        await bot.db.prisma.task.update({
          where: { id: task.id },
          data: { status: 'Selesai' }
        });

        // 3. Ambil Member untuk Tag (Opsional, biar notif masuk)
        let participants = [];
        try {
          const metadata = await bot.sock.groupMetadata(groupId);
          participants = metadata.participants.map((p) => p.id);
        } catch (e) { }

        // Format Waktu
        const timeString = task.deadline.toLocaleString("id-ID", { 
            timeZone: "Asia/Jakarta", 
            weekday: 'long',
            hour: '2-digit', 
            minute: '2-digit'
        });

        // --- PESAN AUTO-CLOSE ---
        const text = `🤖 *SISTEM OTOMATIS*
──────────────────────
Waktu habis! Tugas ini otomatis ditandai selesai/ditutup.

📚 *Mapel:* ${task.mapel}
📝 *Judul:* ${task.judul}
⏰ *Deadline:* ${timeString} WIB

✅ *Status Baru:* SELESAI (Auto-Close)
──────────────────────
_Admin tidak perlu update manual._`;

        // Kirim Pesan
        await bot.sock.sendMessage(groupId, { 
            text: text, 
            mentions: participants 
        });
      }

    } catch (err) { 
        console.error("[CRON-AUTO] Error:", err); 
    }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] Auto-Close Task (Every Minute) loaded.");
};