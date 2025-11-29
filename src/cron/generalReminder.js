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

// --- LOGIKA 1: TASK REMINDER (Standard) ---
async function checkPreciseTaskReminder(bot) {
    const nowMs = new Date().getTime();
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
            
            if (timeRemainingMs <= slot.thresholdMs) {
                if (statusEntry && statusEntry.isSent) continue;

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
╰──────────────────
⚠️ _Segera kumpulkan sebelum terlambat!_
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
                break;
            }
        }
    }
}

// --- LOGIKA UTAMA CRON ---
module.exports = (bot) => {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        try {
            await checkPreciseTaskReminder(bot);
            
            const dueReminders = await bot.db.prisma.reminder.findMany({
                where: { isSent: false, waktu: { lte: now } },
                include: { class: true }
            });

            for (const rem of dueReminders) {
                if (!rem.class) continue;
                const groupId = rem.class.mainGroupId;
                const timeStr = new Date(rem.waktu).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit' });

                // Ambil Metadata Grup
                let groupParticipants = [];
                try {
                    const metadata = await bot.sock.groupMetadata(groupId);
                    groupParticipants = metadata.participants; 
                } catch (e) { }

                // 1. SIAPKAN ARRAY MENTIONS & CEK TIPE (Specific vs All)
                let allMentions = [];
                let isSpecific = false; // Flag penanda
                let ccText = "cc: *All Members*";

                if (rem.targetMembers && rem.targetMembers.length > 5) {
                    // KASUS SPESIFIK
                    isSpecific = true;
                    const specificTargets = rem.targetMembers.split(",");
                    allMentions = allMentions.concat(specificTargets);
                    ccText = "cc: *Mentioned Members*";
                } else {
                    // KASUS ALL MEMBER
                    const allIds = groupParticipants.map(p => p.id);
                    allMentions = allMentions.concat(allIds);
                }

                // 2. LOGIKA SENDER (Hanya dijalankan jika BUKAN Specific)
                // Kita hemat resource, gak perlu cari sender kalau ujung-ujungnya gak ditampilkan
                let senderDisplay = ""; 
                
                if (!isSpecific) {
                    const rawSender = rem.sender ? String(rem.sender) : "";
                    const dbNumberOnly = rawSender.replace(/\D/g, "");
                    
                    if (dbNumberOnly.length > 5) {
                        const matchedMember = groupParticipants.find(p => p.id.startsWith(dbNumberOnly));
                        if (matchedMember) {
                            senderDisplay = `@${matchedMember.id.split('@')[0]}`;
                        } else {
                            senderDisplay = `@${dbNumberOnly}`;
                        }
                    } else {
                        senderDisplay = rawSender || "Admin";
                    }
                }

                // 3. SUSUN PESAN (Conditional Logic)
                let text = `╭── 🔔 *PENGINGAT JADWAL*
│ 🏫 *Kelas:* ${rem.class.name}
│ ⏰ *Waktu:* ${timeStr} WIB
│
│ ❝ *${rem.pesan}* ❞
╰──────────────────`;

                // PERUBAHAN DI SINI:
                // Jika isSpecific = TRUE, jangan tambahkan baris "Oleh".
                // Jika isSpecific = FALSE (All Member), tambahkan baris "Oleh".
                if (!isSpecific) {
                    text += `\n👤 _Oleh: ${senderDisplay}_`;
                }

                // Tambahkan cc di bawahnya
                text += `\n${ccText}`;

                // 4. KIRIM PESAN
                const uniqueMentions = [...new Set(allMentions)];

                await bot.sock.sendMessage(groupId, {
                    text: text,
                    mentions: uniqueMentions
                });

                // 5. HANDLE REPEAT
                const isRepeatable = rem.repeatInterval && rem.repeatUntil;
                if (isRepeatable && rem.repeatUntil > now) {
                    const intervalMs = parseIntervalToMs(rem.repeatInterval);
                    let nextTime = new Date(rem.waktu.getTime() + intervalMs);
                    
                    while (nextTime <= now) {
                        nextTime = new Date(nextTime.getTime() + intervalMs);
                    }

                    if (nextTime < rem.repeatUntil) {
                        await bot.db.prisma.reminder.update({ where: { id: rem.id }, data: { waktu: nextTime, isSent: false } });
                        continue;
                    }
                }
                
                await bot.db.prisma.reminder.update({ where: { id: rem.id }, data: { isSent: true } });
            }

        } catch (err) { console.error("[CRON] Error:", err); }
    }, { timezone: "Asia/Jakarta" });

    console.log("✅ [CRON] Reminder Loaded (Hide Sender on Specific)");
};