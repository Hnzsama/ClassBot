const cron = require("node-cron");

const TARGET_NUMBER = "6285159884234@s.whatsapp.net";

module.exports = (bot) => {
  // Jadwal: 19:24 WIB (Testing)
  cron.schedule('27 19 * * *', async () => {
    console.log('[CRON-PJ] 📞 Menghubungi Dosen...');

    try {
      let message = "";
      
      if (bot.model) {
          // PROMPT SANGAT KETAT: SINGLE OUTPUT, NO META TALK
          const prompt = `Anda adalah Mahasiswa bernama "Bot PJ".
Tugas: Kirim pesan WhatsApp ke Dosen (Panggil "Bapak/Ibu").
Konteks: Konfirmasi kuliah Basis Data besok jam 10 pagi.
Instruksi:
1. Tulis SATU pesan saja.
2. JANGAN ada pilihan (Option 1, Option 2).
3. JANGAN ada placeholder ([Nama], [Tanggal]). Gunakan kata umum yang sopan.
4. JANGAN ada kata pengantar ("Berikut adalah pesan...").
5. Langsung tulis isinya: Salam, Perkenalkan diri, Tanya jadwal (Offline/Online), Terima kasih.

Contoh Output yang dimau:
"Assalamualaikum Bapak/Ibu. Mohon maaf mengganggu. Saya Bot PJ Matkul Basis Data. Izin mengkonfirmasi untuk jadwal kuliah besok jam 10 pagi apakah dilaksanakan secara Offline atau Online nggih? Terima kasih banyak Bapak/Ibu."`;

          try {
            const result = await bot.model.generateContent(prompt);
            message = result.response.text().trim();
            
            // Clean up potential AI artifacts
            message = message.replace(/^"|"$/g, '')  // Remove quotes
                           .replace(/\[.*?\]/g, '') // Remove brackets if any survive
                           .replace(/Option \d+:/g, '') // Remove Option labels
                           .trim();

          } catch (e) {
            console.error("[CRON-PJ] Gagal generate AI, fallback.", e);
            message = "Assalamualaikum Wr. Wb. Selamat malam Bapak/Ibu. Mohon maaf mengganggu. Saya Bot PJ Matkul, izin mengkonfirmasi jadwal kuliah Basis Data besok jam 10:00 apakah dilaksanakan Offline atau Online? Terima kasih. 🙏"; 
          }
      } else {
         message = "Assalamualaikum Wr. Wb. Selamat malam Bapak/Ibu. Mohon maaf mengganggu. Saya Bot PJ Matkul, izin mengkonfirmasi jadwal kuliah Basis Data besok jam 10:00 apakah dilaksanakan Offline atau Online? Terima kasih. 🙏";
      }

      await bot.sock.sendMessage(TARGET_NUMBER, { text: message });
      console.log(`[CRON-PJ] ✅ Pesan terkirim ke ${TARGET_NUMBER} (AI Generated)`);

    } catch (err) {
      console.error("[CRON-PJ] ❌ Gagal kirim pesan:", err);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ [CRON] PJ Matkul Sender (19:24) loaded.");
};
