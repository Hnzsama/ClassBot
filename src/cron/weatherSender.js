const cron = require("node-cron");
// Using native fetch (supported in Node 18+)

// BMKG API for Ketintang, Surabaya
const BMKG_API_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=35.78.22.1004";

// Logic Constants
const TARGET_GROUP_ID = "120363421309923905@g.us";

module.exports = (bot) => {
    // JADWAL: Jam 06:00 WIB Setiap Hari
    cron.schedule('0 6 * * *', async () => {
        console.log('[CRON-WEATHER] 🔄 Mengambil data cuaca BMKG...');

        try {
            // 1. Ambil semua kelas
            const classes = await bot.db.prisma.class.findMany({
                where: { mainGroupId: TARGET_GROUP_ID },
                select: { mainGroupId: true, name: true }
            });
            if (classes.length === 0) {
                console.log("[CRON-WEATHER] Tidak ada kelas terdaftar.");
                return;
            }

            // 2. Fetch Data dari BMKG
            const response = await fetch(BMKG_API_URL);
            if (!response.ok) {
                throw new Error(`BMKG API Error: ${response.statusText}`);
            }
            const data = await response.json();

            // 3. Parse Data Penting 
            if (!data?.data?.[0]?.cuaca) {
                throw new Error("Struktur data BMKG tidak valid.");
            }

            const cuacaList = data.data[0].cuaca.flat();
            const relevantTimes = [6, 12, 18];
            const forecastSummary = [];

            relevantTimes.forEach(targetHour => {
                const entry = cuacaList.find(c => {
                    if (!c.local_datetime) return false;
                    const hour = new Date(c.local_datetime).getHours();
                    return hour === targetHour || hour === targetHour + 1;
                });

                if (entry) {
                    forecastSummary.push({
                        jam: targetHour === 6 ? "Pagi" : targetHour === 12 ? "Siang" : "Malam",
                        suhu: entry.t,
                        cuaca: entry.weather_desc,
                        kelembapan: entry.hu
                    });
                }
            });

            // 4. Generate Pesan (AI / Fallback) - Generate Once
            let message = "";
            const location = `📍 ${data.lokasi?.desa || 'Ketintang'}, ${data.lokasi?.kotkab || 'Surabaya'}`;
            const header = `🌤️ *Prakiraan Cuaca Surabaya Hari Ini* 🌤️`;

            if (bot.model) {
                const aiPrompt = `
Data Cuaca: ${JSON.stringify(forecastSummary)}
Lokasi: ${location}

Tugas: Buat laporan cuaca super singkat.
JANGAN pakai format markdown heading (seperti # atau ##).
JANGAN tambah kalimat pembuka seperti "Berikut laporan cuaca" atau "Halo mahasiswa".
LANGSUNG SAJA isi format di bawah ini:

${header}

${location}

• *Pagi:* {isi suhu}°C, {isi cuaca}
• *Siang:* {isi suhu}°C, {isi cuaca}
• *Malam:* {isi suhu}°C, {isi cuaca}

_Sumber: BMKG_
`;

                try {
                    const result = await bot.model.generateContent(aiPrompt);
                    const aiText = result.response.text().trim();
                    message = aiText;
                } catch (e) {
                    console.error("[CRON-WEATHER] AI Gen Failed:", e.message);
                    message = formatManualMessage(header, location, forecastSummary);
                }
            } else {
                message = formatManualMessage(header, location, forecastSummary);
            }

            // 5. Loop Kirim ke Semua Kelas
            console.log(`[CRON-WEATHER] Mengirim ke ${classes.length} kelas...`);
            for (const cls of classes) {
                if (!cls.mainGroupId) continue;
                try {
                    await bot.sock.sendMessage(cls.mainGroupId, { text: message });
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    console.error(`[CRON-WEATHER] Gagal kirim ke ${cls.name}:`, e.message);
                }
            }
            console.log("[CRON-WEATHER] ✅ Selesai mengirim laporan cuaca.");

        } catch (err) {
            console.error("[CRON-WEATHER] Error:", err.message);
        }
    }, {
        timezone: "Asia/Jakarta"
    });

    console.log("✅ [CRON] Weather Sender (Jadwal: 06:00) loaded.");
};

function formatManualMessage(header, location, summary) {
    let text = `${header}\n\n${location}\n\n`;
    summary.forEach(item => {
        text += `• *${item.jam}:* ${item.suhu}°C, ${item.cuaca}\n`;
    });
    text += `\n_Sumber: BMKG_`;
    return text;
}
