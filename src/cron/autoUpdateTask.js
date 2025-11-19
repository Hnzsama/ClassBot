// src/cron/autoUpdateTask.js
const cron = require("node-cron");

module.exports = (bot) => {
  // Jadwal: Setiap Tengah Malam (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON-AUTO] 🔄 Menjalankan pembersihan tugas kadaluarsa...');
    
    const now = new Date();
    // Set waktu ke 00:00:00 hari ini untuk perbandingan yang adil
    now.setHours(0, 0, 0, 0);

    try {
      // 1. Ambil semua tugas yang masih PENDING
      const pendingTasks = await bot.db.prisma.task.findMany({
        where: { status: 'Pending' },
        include: { class: true }
      });

      let count = 0;

      for (const task of pendingTasks) {
        if (!task.class) continue;

        const deadlineDate = new Date(task.deadline);
        // Set deadline ke 00:00:00 juga
        deadlineDate.setHours(0, 0, 0, 0);

        // 2. LOGIKA: Jika Deadline < Hari Ini (Berarti sudah kemarin/lewat)
        if (deadlineDate < now) {
          const groupId = task.class.groupId;
          
          // --- Update Status di Database ---
          await bot.db.prisma.task.update({
            where: { id: task.id },
            data: { status: 'Terlewat' } // Status baru
          });

          // --- Siapkan Tag All ---
          let participants = [];
          try {
            const metadata = await bot.sock.groupMetadata(groupId);
            participants = metadata.participants.map((p) => p.id);
          } catch (e) {
            // Ignore error metadata
          }

          // --- Kirim Laporan ke Grup ---
          const text = `🤖 *AUTO UPDATE SYSTEM* 🤖
          
Halo kelas *${task.class.name}*!
Tugas berikut telah melewati tenggat waktu (Deadline: ${task.deadline.toLocaleDateString("id-ID")}).

📚 *Mapel:* ${task.mapel}
📝 *Judul:* ${task.judul}
🔄 *Status Baru:* ❌ *TERLEWAT*

_Status tugas ini otomatis diubah oleh sistem karena belum diselesaikan hingga batas waktu._`;

          await bot.sock.sendMessage(groupId, { 
            text: text,
            mentions: participants
          });
          
          count++;
        }
      }

      if (count > 0) console.log(`[CRON-AUTO] ${count} tugas diperbarui menjadi Terlewat.`);

    } catch (err) {
      console.error("[CRON-AUTO] Error:", err);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ [CRON] Auto Update Task (00:00) loaded.");
};