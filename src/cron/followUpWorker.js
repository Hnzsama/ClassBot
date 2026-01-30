const cron = require("node-cron");
const taskQueue = require("../utils/taskQueue");

module.exports = (bot) => {
    // Cek antrian setiap menit
    cron.schedule('* * * * *', async () => {
        // 1. Ambil task yang sudah waktunya
        const dueTasks = taskQueue.popDueTasks();
        if (dueTasks.length === 0) return;

        console.log(`[CRON-FOLLOWUP] Memproses ${dueTasks.length} antrian follow-up...`);

        for (const task of dueTasks) {
            try {
                const { targetNumber, context } = task;

                // 2. Generate Pesan Follow Up Pakai AI
                let message = "Mohon maaf Pak/Bu, izin menanyakan kembali perihal jadwal.";

                if (bot.model) {
                    const prompt = `Anda adalah Mahasiswa (PJ Matkul).
TUJUAN: Follow-up/Menagih janji ke Dosen yang sebelumnya bilang "nanti dikabari".
KONTEKS: ${context}
INSTRUKSI:
- Buat kalimat sopan, singkat, mengingatkan janji.
- Jangan terkesan memaksa.
- Contoh: "Assalamualaikum Pak, mohon maaf mengganggu. Izin menanyakan kembali perihal kepastian jadwal besok nggih Pak. Terima kasih."`;

                    try {
                        const result = await bot.model.generateContent(prompt);
                        message = result.response.text().trim().replace(/^"|"$/g, '');
                    } catch (e) {
                        console.error("[CRON-FOLLOWUP] Gagal generate AI:", e);
                    }
                }

                // 3. Kirim Pesan
                await bot.sock.sendMessage(targetNumber, { text: message });
                console.log(`[CRON-FOLLOWUP] Sent to ${targetNumber}`);

            } catch (err) {
                console.error(`[CRON-FOLLOWUP] Failed task ${task.id}:`, err);
            }
        }
    }, {
        timezone: "Asia/Jakarta"
    });

    console.log("✅ [CRON] Follow-Up Worker (Every Minute) loaded.");
};
