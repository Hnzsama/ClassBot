// src/cron/taskReminder.js
const cron = require("node-cron");
const MS_IN_HOUR = 3600000;

module.exports = (bot) => {
  // Jadwal: Setiap Awal Jam (00 menit)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON-TASK] 🔄 Hourly task check (CatchUp & Smart Tagging)...');
    try {
      const nowMs = new Date().getTime();
      const pendingTasks = await bot.db.prisma.task.findMany({
        where: { status: 'Pending' },
        include: { class: true, reminderStatuses: true }
      });

      // Urutan Prioritas: Cek slot waktu paling kritis dulu
      const slots = [
          { type: 'H-6', thresholdMs: 6 * MS_IN_HOUR },
          { type: 'H-12', thresholdMs: 12 * MS_IN_HOUR },
          { type: 'H-24', thresholdMs: 24 * MS_IN_HOUR },
      ];

      for (const task of pendingTasks) {
        if (!task.class) continue;

        const timeRemainingMs = task.deadline.getTime() - nowMs;
        const groupId = task.class.mainGroupId;
        
        // Skip jika sudah lewat deadline atau sisa waktu kurang dari 1 jam (ditangani generalReminder)
        if (timeRemainingMs <= 1 * MS_IN_HOUR) continue;

        for (const slot of slots) {
          // Logika Catch-Up: Jika sisa waktu sudah masuk/melewati threshold
          if (timeRemainingMs <= slot.thresholdMs) {
            
            const statusEntry = task.reminderStatuses.find(s => s.reminderType === slot.type);
            
            // Jika sudah dikirim, skip
            if (statusEntry && statusEntry.isSent) break; 

            // --- 1. PROSES MEMBER & TAGGING ---
            let groupParticipants = [];
            try {
                const metadata = await bot.sock.groupMetadata(groupId);
                groupParticipants = metadata.participants.map(p => p.id);
            } catch (e) { 
                console.error(`[CRON-TASK] Gagal fetch metadata grup ${groupId}`);
                continue; 
            }

            const finishedIds = task.finishedMemberIds ? task.finishedMemberIds.split(",") : [];
            
            // Filter: Siapa yang BELUM selesai?
            const unfinishedMembers = groupParticipants.filter(memberId => {
                const numberOnly = memberId.split("@")[0];
                return !finishedIds.includes(numberOnly);
            });

            // Hitung Statistik
            const totalStudents = groupParticipants.length;
            const totalFinished = finishedIds.length;
            const totalUnfinished = unfinishedMembers.length;


            // --- 2. SIAPKAN PESAN ---
            const hours = Math.ceil(timeRemainingMs / MS_IN_HOUR);
            const deadlineStr = task.deadline.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: 'medium', timeStyle: 'short' });
            const linkRow = (task.link && task.link !== '-' && task.link !== '') ? `\n│ 🔗 *Link:* ${task.link}` : '';

            const text = `╭── 🔥 *DEADLINE ALERT*
│ 🏫 *Kelas:* ${task.class.name}
│ 📚 *Mapel:* ${task.mapel}
│ 📝 *Judul:* ${task.judul}
│
│ ⏳ *Sisa Waktu:* ${hours} Jam (${slot.type})
│ 🗓️ *Deadline:* ${deadlineStr}${linkRow}
│
│ 📊 *Status Pengumpulan:*
│ ✅ Sudah: ${totalFinished} mahasiswa
│ ❌ Belum: ${totalUnfinished} mahasiswa
│ (Total: ${totalStudents} mahasiswa)
╰──────────────────
_Yuk dicicil, jangan ditunda!_
cc: *Unfinished Members*`;

            // --- 3. KIRIM PESAN (Hanya tag yang belum) ---
            if (unfinishedMembers.length > 0) {
                await bot.sock.sendMessage(groupId, { 
                    text, 
                    mentions: unfinishedMembers // Smart Tagging
                });
            } else {
                // Jika semua sudah selesai, kirim apresiasi tanpa tag
                await bot.sock.sendMessage(groupId, { 
                    text: `🎉 *KEREN!* Tugas *${task.judul}* sudah selesai dikerjakan oleh semua anggota kelas! Pertahankan! 👍`
                });
            }

            // Simpan Status Terkirim
            if (statusEntry) {
              await bot.db.prisma.taskReminderStatus.update({ where: { id: statusEntry.id }, data: { isSent: true } });
            } else {
              await bot.db.prisma.taskReminderStatus.create({ data: { taskId: task.id, reminderType: slot.type, isSent: true } });
            }
            
            // Break loop slots agar tidak double notify
            break; 
          }
        }
      }
    } catch (err) { console.error("[CRON-TASK] Error:", err); }
  }, { timezone: "Asia/Jakarta" });

  console.log("✅ [CRON] Task Reminder (Hourly Smart Tagging) loaded.");
};