const cron = require("node-cron");

// ID Target: GRUP UTAMA
const TARGET_GROUP_ID = "120363421309923905@g.us";
const BMKG_API_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=35.78.22.1004"; // Ketintang, Surabaya

module.exports = (bot) => {
    // JADWAL: Jam 06:00 WIB Setiap Hari
    cron.schedule('0 6 * * *', async () => {
        console.log('[CRON-WEATHER] 🔄 Mengambil data cuaca BMKG...');

        try {
            // 1. Fetch Data dari BMKG
            const response = await fetch(BMKG_API_URL);
            if (!response.ok) {
                throw new Error(`BMKG API Error: ${response.statusText}`);
            }
            const data = await response.json();

            // 2. Parse Data Penting (Ambil data hari ini/besok yang relevan)
            // Struktur: data.data[0].cuaca (Array per jam)
            if (!data?.data?.[0]?.cuaca) {
                throw new Error("Struktur data BMKG tidak valid.");
            }

            const cuacaList = data.data[0].cuaca.flat(); // Flatten array of arrays

            // Ambil cuaca untuk jam-jam penting (Pagi 06:00, Siang 12:00, Malam 18:00)
            // Data BMKG biasanya per 3 jam atau per jam. Kita cari yang mendekati.
            const relevantTimes = [6, 12, 18];
            const forecastSummary = [];

            relevantTimes.forEach(targetHour => {
                // Cari entry yang local_datetime jamnya cocok
                const entry = cuacaList.find(c => {
                    if (!c.local_datetime) return false;
                    const hour = new Date(c.local_datetime).getHours();
                    return hour === targetHour || hour === targetHour + 1; // Toleransi 1 jam
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

            // 3. Generate Pesan (AI / Fallback)
            let message = `🌤️ *Prakiraan Cuaca Surabaya Hari Ini* 🌤️\n\n`;
            const location = `📍 ${data.lokasi?.desa || 'Ketintang'}, ${data.lokasi?.kotkab || 'Surabaya'}`;

            if (bot.model) {
                // AI MODE
                const aiPrompt = `
            Bertindaklah sebagai penyiar radio kampus yang asik. Buatkan laporan cuaca untuk mahasiswa Unesa hari ini berdasarkan data ini:
            Lokasi: ${location}
            Data: ${JSON.stringify(forecastSummary)}
            
            Gunakan gaya bahasa santai, semangat pagi, dan selipkan tips singkat (misal: "jangan lupa bawa payung" kalau hujan, atau "pakai sunscreen" kalau panas). 
            
            Format output:
            [Opening Semangat]
            [Detail Cuaca Pagi/Siang/Malam pake emoji]
            [Tips Harian]
            
            Sumber data: BMKG.
            `;

                try {
                    const result = await bot.model.generateContent(aiPrompt);
                    const aiText = result.response.text().trim();
                    message = `📻 *Weather Update - ClassBot*\n\n${aiText}`;
                } catch (e) {
                    console.error("[CRON-WEATHER] AI Gen Failed:", e.message);
                    // Fallback ke manual
                    message += formatManualMessage(location, forecastSummary);
                }
            } else {
                // MANUAL MODE
                message += formatManualMessage(location, forecastSummary);
            }

            // 4. Kirim Pesan
            await bot.sock.sendMessage(TARGET_GROUP_ID, { text: message });
            console.log(`[CRON-WEATHER] ✅ Sukses kirim laporan cuaca.`);

        } catch (err) {
            console.error("[CRON-WEATHER] Error:", err.message);
        }
    }, {
        timezone: "Asia/Jakarta"
    });

    console.log("✅ [CRON] Weather Sender (Jadwal: 06:00) loaded.");
};

function formatManualMessage(location, summary) {
    let text = `${location}\n\n`;
    summary.forEach(item => {
        text += `• *${item.jam}:* ${item.suhu}°C, ${item.cuaca}\n`;
    });
    text += `\n_Sumber: BMKG_`;
    return text;
}
