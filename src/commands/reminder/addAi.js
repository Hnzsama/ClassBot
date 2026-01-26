const parseWIB = (timeStr) => {
    if (!timeStr) return null;
    const isoStart = timeStr.replace(" ", "T") + ":00+07:00";
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

const validateInterval = (intervalStr) => {
    if (!intervalStr) return null;
    const regex = /^(\d+)([mhd])$/;
    const match = intervalStr.match(regex);
    if (!match) return null;
    const value = parseInt(match[1]);
    if (match[2] === 'm' && value < 1) return null;
    return intervalStr;
};

module.exports = {
    name: "#reminder-add-ai",
    description: "Pasang pengingat pintar via AI (Support Tasks & Mentions).",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, model, db } = bot;

        if (!from.endsWith("@g.us")) return;

        const requestText = args.join(' ').trim();
        if (requestText.length < 5) {
            return bot.sock.sendMessage(from, { text: "⚠️ Deskripsi terlalu pendek." });
        }
        if (!model) {
            return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif." });
        }

        // 1. AMBIL MENTIONS (Logic Sama)
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
        const mentionedJids = contextInfo.mentionedJid || contextInfo.mentions || [];
        const targetMembers = mentionedJids.length > 0 ? mentionedJids.join(",") : null;

        // 2. AMBIL KELAS (Dual Check)
        const kelas = await db.prisma.class.findFirst({
            where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
        });
        if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

        try {
            await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

            // --- FITUR BARU: AMBIL DATA TUGAS SEBAGAI KONTEKS ---
            // Ambil tugas pending untuk membantu AI mengenali deadline
            const pendingTasks = await db.prisma.task.findMany({
                where: { classId: kelas.id, status: "Pending" },
                select: { id: true, mapel: true, judul: true, deadline: true }
            });

            // Format data tugas menjadi string ringkas untuk prompt
            let tasksContext = "TIDAK ADA TUGAS PENDING.";
            if (pendingTasks.length > 0) {
                tasksContext = pendingTasks.map(t => {
                    const dStr = t.deadline.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
                    return `- (ID:${t.id}) ${t.mapel}: "${t.judul}" (Deadline: ${dStr} WIB)`;
                }).join("\n");
            }
            // ----------------------------------------------------

            const options = { timeZone: 'Asia/Jakarta', hour12: false };
            const now = new Date();
            const currentParts = {
                year: now.toLocaleString('en-US', { ...options, year: 'numeric' }),
                month: now.toLocaleString('en-US', { ...options, month: '2-digit' }),
                day: now.toLocaleString('en-US', { ...options, day: '2-digit' }),
                hour: now.toLocaleString('en-US', { ...options, hour: '2-digit' }),
                minute: now.toLocaleString('en-US', { ...options, minute: '2-digit' }),
                weekday: now.toLocaleString('id-ID', { ...options, weekday: 'long' })
            };
            const dateContextIndo = `${currentParts.weekday}, ${currentParts.day}-${currentParts.month}-${currentParts.year} Jam ${currentParts.hour}:${currentParts.minute}`;

            // --- UPDATE PROMPT DENGAN DATA TUGAS ---
            const systemPrompt = `
      Anda adalah Reminder Extractor Cerdas.
      
      INFO KONTEKS:
      - Waktu Sekarang: ${dateContextIndo} WIB
      - Daftar Tugas Aktif di Database:
      ${tasksContext}
      
      INSTRUKSI UTAMA:
      Analisis input user. Jika user merujuk ke tugas tertentu (misal "ingetin tugas alpro"), cari deadline tugas tersebut di daftar di atas, lalu gunakan deadline itu sebagai acuan waktu (misal untuk 'repeatUntil' atau 'waktuMulai').
      
      Aturan Ekstraksi:
      1. WaktuMulai: 'YYYY-MM-DD HH:mm'. Harus masa depan.
      2. RepeatInterval: Format '15m', '1h'. (Opsional)
      3. RepeatUntil: 'YYYY-MM-DD HH:mm'. (Opsional, biasanya deadline tugas).
      4. Pesan: Bersihkan dari mention (@user).

      Input User: "${requestText}"

      Contoh Output JSON:
      { "pesan": "Kerjain Alpro woy", "waktuMulai": "2025-11-23 18:00", "repeatInterval": "30m", "repeatUntil": "2025-11-24 23:59" }
      `;

            const contents = [{ role: "user", parts: [{ text: systemPrompt }] }];
            const result = await model.generateContent({ contents });

            let jsonString = result.response.text().trim().replace(/```json|```/g, "").trim();
            const firstBracket = jsonString.indexOf("[");
            const lastBracket = jsonString.lastIndexOf("]");

            if (firstBracket !== -1 && lastBracket !== -1) {
                jsonString = jsonString.substring(firstBracket, lastBracket + 1);
            } else {
                const firstCurly = jsonString.indexOf("{");
                const lastCurly = jsonString.lastIndexOf("}");
                if (firstCurly !== -1 && lastCurly !== -1) {
                    jsonString = `[${jsonString.substring(firstCurly, lastCurly + 1)}]`;
                }
            }

            let remindersData = [];
            try {
                remindersData = JSON.parse(jsonString);
            } catch (e) { throw new Error("Format data AI rusak."); }

            if (!Array.isArray(remindersData)) remindersData = [remindersData];

            let successCount = 0;
            let failCount = 0;
            let summaryText = "";

            for (const data of remindersData) {
                const waktuMulai = parseWIB(data.waktuMulai);
                const nowCheck = new Date();

                if (!waktuMulai || isNaN(waktuMulai.getTime()) || waktuMulai < new Date(nowCheck.getTime() - 300000)) {
                    failCount++;
                    continue;
                }

                let repeatInterval = null;
                let repeatUntil = null;
                let originalInterval = data.repeatInterval;

                if (originalInterval) {
                    repeatInterval = validateInterval(originalInterval);
                    if (repeatInterval) {
                        if (data.repeatUntil) {
                            repeatUntil = parseWIB(data.repeatUntil);
                            if (!repeatUntil || repeatUntil <= waktuMulai) repeatUntil = null;
                        } else { repeatInterval = null; }
                    } else { repeatInterval = null; }
                }

                await db.prisma.reminder.create({
                    data: {
                        pesan: data.pesan,
                        waktu: waktuMulai,
                        classId: kelas.id,
                        sender: sender.split("@")[0],
                        repeatInterval: repeatInterval,
                        repeatUntil: repeatUntil,
                        targetMembers: targetMembers
                    }
                });

                const timeStr = waktuMulai.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit' });
                summaryText += `✅ *${timeStr}*: ${data.pesan}`;
                if (repeatInterval) summaryText += ` (Tiap ${repeatInterval})`;
                summaryText += `\n`;

                successCount++;
            }

            if (successCount > 0) {
                let header = `✨ *${successCount} JADWAL DISIMPAN* ✨`;
                let mentionsToReply = [sender];

                if (targetMembers) {
                    const targets = targetMembers.split(",");
                    mentionsToReply = mentionsToReply.concat(targets);
                    const formattedTags = targets.map(id => `@${id.split('@')[0]}`).join(", ");
                    header += `\n👥 *Tagging:* ${formattedTags}`;
                } else {
                    header += `\n👥 *Tagging:* Semua Member`;
                }

                await sock.sendMessage(from, {
                    text: `${header}\n\n${summaryText}`,
                    mentions: mentionsToReply
                });
            } else {
                await sock.sendMessage(from, { text: "❌ Gagal. Waktu yang diminta sudah terlewat atau tidak dikenali." });
            }

        } catch (e) {
            console.error("Error reminder-ai:", e);
            await sock.sendMessage(from, { text: `❌ Error: ${e.message}` });
        }
    }
};