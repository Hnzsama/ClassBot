// src/cron/generalReminder.js
const cron = require("node-cron");

module.exports = (bot) => {
  // Jadwal: Setiap Menit
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    try {
      const dueReminders = await bot.db.prisma.reminder.findMany({
        where: {
          isSent: false,
          waktu: { lte: now }
        },
        include: { class: true }
      });

      if (dueReminders.length > 0) {
        console.log(`[CRON-GENERAL] Mengirim ${dueReminders.length} pengingat...`);
      }

      for (const rem of dueReminders) {
        if (!rem.class) continue;

        const groupId = rem.class.groupId;
        let participants = [];

        // --- LOGIKA TAG ALL ---
        try {
          const metadata = await bot.sock.groupMetadata(groupId);
          participants = metadata.participants.map((p) => p.id);
        } catch (e) {
          console.error(`[CRON-GENERAL] Gagal fetch member grup ${groupId}:`, e.message);
        }

        // Format Waktu agar enak dibaca (Contoh: Senin, 20 Okt, 10:30)
        const timeString = new Date(rem.waktu).toLocaleString("id-ID", { 
            weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
        });

        // --- FORMAT PESAN KEREN ---
        const text = `🔔 *PENGINGAT JADWAL* 🔔

Halo teman-teman *${rem.class.name}*!
Ada pengingat penting untuk kalian:

❝ *${rem.pesan}* ❞

🗓️ Waktu: ${timeString}
👤 Oleh: @${rem.sender || "Admin"}

_Mohon diperhatikan ya!_`;

        // Kirim Pesan + Tag All
        await bot.sock.sendMessage(groupId, { 
            text: text,
            mentions: participants // Array ID member untuk mentrigger notifikasi
        });

        // Update status DB
        await bot.db.prisma.reminder.update({
          where: { id: rem.id },
          data: { isSent: true }
        });
      }

    } catch (err) {
      console.error("[CRON-GENERAL] Error:", err);
    }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] General Reminder (Per Menit) loaded.");
};