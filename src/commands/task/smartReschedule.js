const { generateAIContent } = require('../../utils/aiHandler');

module.exports = {
    name: "#task-reschedule",
    description: "AI Smart Reschedule to balance task load.",
    execute: async (bot, from, sender, args) => {
        const { sock, db, model } = bot;

        // 1. Fetch Tasks
        const tasks = await db.prisma.task.findMany({
            where: {
                class: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
                status: 'Pending'
            },
            orderBy: { deadline: 'asc' }
        });

        if (tasks.length === 0) return sock.sendMessage(from, { text: "✅ Tidak ada tugas pending." });

        // 2. Prepare Context
        const taskList = tasks.map(t =>
            `- ID:${t.id} [${t.mapel}] "${t.judul}" (Deadline: ${t.deadline.toDateString()})`
        ).join("\n");

        const prompt = `
    Analisis daftar tugas berikut. Identifikasi hari yang penumpukan tugasnya berlebihan (lebih dari 3 tugas sehari).
    Sarankan jadwal baru yang lebih seimbang, tapi JANGAN ubah deadline tugas yang sudah lewat atau H-1.
    
    Output JSON Format:
    [
      { "id": 123, "recommendation": "Geser ke Jumat", "reason": "Kamis sudah 4 tugas" }
    ]
    Jika beban aman, return [].
    `;

        // 3. Call AI
        try {
            await sock.sendMessage(from, { text: "🧠 Sedang menganalisis beban tugas..." });

            const suggestions = await generateAIContent(model, prompt, taskList, "Cek jadwal saya");

            if (!suggestions || suggestions.length === 0) {
                return sock.sendMessage(from, { text: "✅ Jadwal tugas aman terkendali! Tidak perlu reschedule." });
            }

            // 4. Present Suggestions
            let msg = "⚠️ *SARAN RESCHEDULE (AI)*\n\n";
            suggestions.forEach(s => {
                const t = tasks.find(x => x.id === s.id);
                if (t) {
                    msg += `📌 *${t.mapel} - ${t.judul}*\n   Suggestion: ${s.recommendation}\n   Alasan: ${s.reason}\n\n`;
                }
            });

            msg += "_Gunakan_ `#task-edit [ID] deadline [Waktu]` _untuk mengubah manual._";
            await sock.sendMessage(from, { text: msg });

        } catch (e) {
            console.error(e);
            await sock.sendMessage(from, { text: "❌ Gagal menganalisis jadwal." });
        }
    }
};
