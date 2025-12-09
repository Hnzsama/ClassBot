// src/cron/generalReminder.js
const cron = require("node-cron");
const MS_IN_MINUTE = 60000;
const MS_IN_HOUR = 3600000;

// Utility parsing interval
const parseIntervalToMs = (intervalStr) => {
    if (!intervalStr) return 0;
    const value = parseInt(intervalStr);
    const unit = intervalStr.slice(-1);
    if (unit === 'm') return value * MS_IN_MINUTE;
    if (unit === 'h') return value * MS_IN_MINUTE * 60;
    if (unit === 'd') return value * MS_IN_MINUTE * 60 * 24;
    return 0;
};

// --- LOGIKA 1: TASK REMINDER (Smart Tagging) ---
async function checkPreciseTaskReminder(bot) {
    const nowMs = new Date().getTime();
    
    // Ambil tugas yang deadline-nya dalam 26 jam ke depan
    const pendingTasks = await bot.db.prisma.task.findMany({
        where: {
            status: 'Pending',
            deadline: { gt: new Date(nowMs), lt: new Date(nowMs + (26 * MS_IN_HOUR)) }
        },
        include: { class: true, reminderStatuses: true }
    });

    const slots = [
        { type: 'H-1', thresholdMs: 1 * MS_IN_HOUR },
        { type: 'H-6', thresholdMs: 6 * MS_IN_HOUR },
        { type: 'H-12', thresholdMs: 12 * MS_IN_HOUR },
        { type: 'H-24', thresholdMs: 24 * MS_IN_HOUR },
    ];

    for (const task of pendingTasks) {
        if (!task.class) continue;
        const groupId = task.class.mainGroupId;
        const timeRemainingMs = task.deadline.getTime() - nowMs;

        if (timeRemainingMs <= 0) continue;

        for (const slot of slots) {
            const statusEntry = task.reminderStatuses.find(s => s.reminderType === slot.type);
            
            // Cek apakah masuk slot waktu dan belum dikirim
            if (timeRemainingMs <= slot.thresholdMs) {
                if (statusEntry && statusEntry.isSent) continue;

                // --- 1. PROSES MEMBER & TAGGING ---
                let groupParticipants = [];
                try {
                    const metadata = await bot.sock.groupMetadata(groupId);
                    groupParticipants = metadata.participants.map(p => p.id);
                } catch (e) { 
                    console.error(`[CRON] Gagal fetch metadata grup ${groupId}`);
                    continue; 
                }

                const finishedIds = task.finishedMemberIds ? task.finishedMemberIds.split(",") : [];
                
                // Filter: Siapa yang BELUM selesai?
                // Logic: Ambil semua member grup, buang yang nomornya ada di finishedIds
                const unfinishedMembers = groupParticipants.filter(memberId => {
                    const numberOnly = memberId.split("@")[0];
                    return !finishedIds.includes(numberOnly);
                });

                // Hitung Statistik
                const totalStudents = groupParticipants.length;
                const totalFinished = finishedIds.length;
                const totalUnfinished = unfinishedMembers.length;

                // --- 2. SIAPKAN PESAN ---
                const days = Math.floor(timeRemainingMs / (24 * MS_IN_HOUR));
                const hours = Math.ceil((timeRemainingMs % (24 * MS_IN_HOUR)) / MS_IN_HOUR);
                const minutes = Math.ceil(timeRemainingMs / MS_IN_MINUTE);
                let timeString = slot.type === 'H-1' ? `${minutes} Menit` : `${days > 0 ? `${days} Hari ` : ''}${hours} Jam`;
                
                const deadlineStr = task.deadline.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: 'medium', timeStyle: 'short' });
                const linkRow = (task.link && task.link !== '-' && task.link !== '') ? `\n│ 🔗 *Link:* ${task.link}` : '';

                const text = `╭── 🔥 *DEADLINE ALERT*
│ 🏫 *Kelas:* ${task.class.name}
│ 📚 *Mapel:* ${task.mapel}
│ 📝 *Judul:* ${task.judul}
│
│ ⏳ *Sisa Waktu:* ${timeString} (${slot.type})
│ 🗓️ *Batas:* ${deadlineStr}${linkRow}
│
│ 📊 *Status Pengumpulan:*
│ ✅ Sudah: ${totalFinished} mahasiswa
│ ❌ Belum: ${totalUnfinished} mahasiswa
│ (Total: ${totalStudents} mahasiswa)
╰──────────────────
⚠️ _Mention khusus untuk yang belum mengumpulkan!_
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
                        text: `🎉 *SELAMAT!* Semua siswa telah menyelesaikan tugas *${task.judul}* tepat waktu! Keren! 👍`
                    });
                }

                // Update DB Status
                if (statusEntry) {
                    await bot.db.prisma.taskReminderStatus.update({ where: { id: statusEntry.id }, data: { isSent: true } });
                } else {
                    await bot.db.prisma.taskReminderStatus.create({ data: { taskId: task.id, reminderType: slot.type, isSent: true } });
                }
                break; 
            }
        }
    }
}

// --- LOGIKA UTAMA CRON (Sama seperti sebelumnya) ---
module.exports = (bot) => {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        try {
            // 1. Cek Smart Task Reminder
            await checkPreciseTaskReminder(bot);
            
            // 2. Cek General Reminder (Logic lama tetap berjalan di sini)
            const dueReminders = await bot.db.prisma.reminder.findMany({
                where: { isSent: false, waktu: { lte: now } },
                include: { class: true }
            });

            for (const rem of dueReminders) {
                // ... (Logic General Reminder Anda yang sudah bagus, biarkan tetap sama) ...
                if (!rem.class) continue;
                const groupId = rem.class.mainGroupId;
                const timeStr = new Date(rem.waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit' });

                let groupParticipants = [];
                try {
                    const metadata = await bot.sock.groupMetadata(groupId);
                    groupParticipants = metadata.participants; 
                } catch (e) { }

                let allMentions = [];
                let isSpecific = false;
                let ccText = "cc: *All Members*";

                if (rem.targetMembers && rem.targetMembers.length > 5) {
                    isSpecific = true;
                    const specificTargets = rem.targetMembers.split(",");
                    allMentions = allMentions.concat(specificTargets);
                    ccText = "cc: *Mentioned Members*";
                } else {
                    const allIds = groupParticipants.map(p => p.id);
                    allMentions = allMentions.concat(allIds);
                }

                let senderDisplay = ""; 
                if (!isSpecific) {
                    const rawSender = rem.sender ? String(rem.sender) : "";
                    const dbNumberOnly = rawSender.replace(/\D/g, "");
                    if (dbNumberOnly.length > 5) {
                        const matchedMember = groupParticipants.find(p => p.id.startsWith(dbNumberOnly));
                        senderDisplay = matchedMember ? `@${matchedMember.id.split('@')[0]}` : `@${dbNumberOnly}`;
                    } else {
                        senderDisplay = rawSender || "Admin";
                    }
                }

                let text = `╭── 🔔 *PENGINGAT JADWAL*
│ 🏫 *Kelas:* ${rem.class.name}
│ ⏰ *Waktu:* ${timeStr} WIB
│
│ ❝ *${rem.pesan}* ❞
╰──────────────────`;

                if (!isSpecific) {
                    text += `\n👤 _Oleh: ${senderDisplay}_`;
                }
                text += `\n${ccText}`;

                const uniqueMentions = [...new Set(allMentions)];
                await bot.sock.sendMessage(groupId, { text, mentions: uniqueMentions });

                const isRepeatable = rem.repeatInterval && rem.repeatUntil;
                if (isRepeatable && rem.repeatUntil > now) {
                    const intervalMs = parseIntervalToMs(rem.repeatInterval);
                    let nextTime = new Date(rem.waktu.getTime() + intervalMs);
                    while (nextTime <= now) { nextTime = new Date(nextTime.getTime() + intervalMs); }

                    if (nextTime < rem.repeatUntil) {
                        await bot.db.prisma.reminder.update({ where: { id: rem.id }, data: { waktu: nextTime, isSent: false } });
                        continue;
                    }
                }
                await bot.db.prisma.reminder.update({ where: { id: rem.id }, data: { isSent: true } });
            }

        } catch (err) { console.error("[CRON] Error:", err); }
    }, { timezone: "Asia/Jakarta" });

    console.log("✅ [CRON] Smart Task Reminder Loaded (Unfinished Only)");
};