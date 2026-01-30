const { parseWIB, formatDateIndo } = require('../../utils/dateUtils');
const fs = require('fs');

module.exports = {
    name: "#reschedule",
    description: "Reschedule deadline tugas dengan deteksi konflik. Format: #reschedule [ID/Judul], [Waktu Baru]",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, db } = bot;
        if (!from.endsWith("@g.us")) return;

        let input = text.replace("#reschedule", "").trim();
        if (!input) {
            return sock.sendMessage(from, { text: "⚠️ Format: `#reschedule [ID/Judul], [Waktu Baru]`\nContoh: `#reschedule 15, 2024-02-20 10:00`" });
        }

        // Split args: [Target], [NewDate]
        // Flexible split by comma or last space if no comma
        let targetKey, dateStr;
        if (input.includes(",")) {
            [targetKey, dateStr] = input.split(",").map(s => s.trim());
        } else {
            const parts = input.split(" ");
            dateStr = parts.pop();
            targetKey = parts.join(" ");
        }

        if (!targetKey || !dateStr) return sock.sendMessage(from, { text: "⚠️ Target/Tanggal tidak terbaca." });

        const newDate = parseWIB(dateStr);
        if (!newDate) return sock.sendMessage(from, { text: "❌ Format tanggal salah. Gunakan YYYY-MM-DD HH:mm" });

        try {
            // 1. Find Class
            const kelas = await db.prisma.class.findFirst({ where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } });
            if (!kelas) return;

            // 2. Find Task
            let task;
            if (/^\d+$/.test(targetKey)) {
                task = await db.prisma.task.findUnique({ where: { id: parseInt(targetKey) } });
            } else {
                task = await db.prisma.task.findFirst({
                    where: {
                        classId: kelas.id,
                        OR: [
                            { mapel: { contains: targetKey } },
                            { judul: { contains: targetKey } }
                        ]
                    }
                });
            }

            if (!task) return sock.sendMessage(from, { text: `❌ Tugas "${targetKey}" tidak ditemukan.` });

            // 3. CONGESTION CHECK (Smart Logic)
            // Check tasks on the SAME DAY
            const startOfDay = new Date(newDate); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(newDate); endOfDay.setHours(23, 59, 59, 999);

            const conflicts = await db.prisma.task.findMany({
                where: {
                    classId: kelas.id,
                    deadline: { gte: startOfDay, lte: endOfDay },
                    id: { not: task.id },
                    status: { not: 'Selesai' } // Only count active tasks
                }
            });

            // 4. Warning / Confirmation
            let warningMsg = "";
            if (conflicts.length > 0) {
                warningMsg = `⚠️ *PERINGATAN:* Ada ${conflicts.length} tugas lain di tanggal ${formatDateIndo(newDate)}:\n`;
                conflicts.forEach(t => warningMsg += `- ${t.mapel}: ${t.judul.substring(0, 20)}...\n`);

                // Suggestion logic (Find nearest empty day?)
                // For now just warn.
                warningMsg += `\nLanjut reschedule? Ketik *Y* untuk ya.`;

                // Interactive Session for Confirmation (simplified: just force user to re-type with --force or handle session?
                // Let's use session or arg.
                if (!input.includes("--force")) {
                    bot.sessions.set(sender, {
                        type: "CONFIRM_RESCHEDULE",
                        data: { taskId: task.id, newDate: newDate, originalInput: input }
                    });
                    return sock.sendMessage(from, { text: warningMsg, mentions: [sender] });
                }
            }

            // 5. Execute Update
            await db.prisma.task.update({ where: { id: task.id }, data: { deadline: newDate } });

            // Reset Reminders
            await db.prisma.taskReminderStatus.deleteMany({ where: { taskId: task.id } });

            const datePretty = formatDateIndo(newDate) + " " + newDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });

            let successMsg = `✅ *RESCHEDULE SUCCESS*\n\n`;
            successMsg += `📝 ${task.mapel} - "${task.judul}"\n`;
            successMsg += `📅 Baru: ${datePretty}`;

            if (warningMsg) successMsg += `\n(Diupdate biarpun jadwal padat)`;

            return sock.sendMessage(from, { text: successMsg });

        } catch (e) {
            console.error("Reschedule Error:", e);
            return sock.sendMessage(from, { text: "❌ Error server." });
        }
    }
};
