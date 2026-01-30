const cron = require("node-cron");

const TARGET_NUMBER = "6285159884234@s.whatsapp.net";

module.exports = (bot) => {
  // Jadwal: 19:24 WIB (Testing)
  cron.schedule('46 01 * * *', async () => {
    console.log('[CRON-PJ] 📞 Menghubungi Dosen...');

    try {
      let message = "";

      if (bot.model) {
        // PROMPT ADVANCED (Mirip Handler)
        // Tujuannya agar pesan pembuka tidak kaku, tapi tetap sopan & formal.
        const prompt = `PERAN: Anda adalah Mahasiswa (PJ Mata Kuliah Basis Data) yang Cerdas, Sopan, dan Beretika Tinggi.
TUJUAN: Mengirim pesan WhatsApp pertama kali kepada Dosen untuk konfirmasi jadwal.

DATA:
- Mata Kuliah: Basis Data
- Jadwal Besok: Jam 10:00 Pagi
- Nama Anda: "Bot Asisten Kelas" (Gunakan nama ini, JANGAN pakai [Nama Anda])

INSTRUKSI:
Buatkan pesan pembuka yang:
1. Menggunakan Salam Islami (Assalamualaikum Wr. Wb. / Selamat Malam).
2. Memperkenalkan diri dengan sopan sebagai "Bot Asisten Kelas" (Perwakilan Mahasiswa).
3. Langsung ke inti: Konfirmasi apakah besok jadi kuliah?
4. Menanyakan opsi metode: Offline (Luring) atau Online (Daring)?
5. Menutup dengan ucapan terima kasih dan doa yang baik.

PENTING:
- JANGAN GUNAKAN PLACEHOLDER seperti [Nama Anda], [Nama Dosen], [Tanggal].
- Langsung gunakan kata sapaan umum "Bapak/Ibu" jika tidak tahu nama.
- Gunakan bahasa yang mengalir natural, sopan, dan tidak kaku.

OUTPUT:
Hanya teks pesan saja.`;

        try {
          const result = await bot.model.generateContent(prompt);
          message = result.response.text().trim();

          // Clean up aesthetics
          message = message.replace(/^"|"$/g, '').replace(/\*\*/g, '*');

        } catch (e) {
          console.error("[CRON-PJ] Gagal generate AI, fallback.", e);
          message = "Assalamualaikum Wr. Wb. Selamat malam Bapak/Ibu. Mohon maaf mengganggu waktunya. Saya Bot PJ Matkul, izin mengkonfirmasi untuk jadwal perkuliahan Basis Data besok jam 10:00 apakah dilaksanakan secara Offline atau Online nggih? Terima kasih banyak Bapak/Ibu. 🙏";
        }
      } else {
        message = "Assalamualaikum Wr. Wb. Selamat malam Bapak/Ibu. Mohon maaf mengganggu waktunya. Saya Bot PJ Matkul, izin mengkonfirmasi untuk jadwal perkuliahan Basis Data besok jam 10:00 apakah dilaksanakan secara Offline atau Online nggih? Terima kasih banyak Bapak/Ibu. 🙏";
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
