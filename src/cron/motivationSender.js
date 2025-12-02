// src/cron/motivationSender.js
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Lokasi gambar
const IMAGE_PATH = path.join(__dirname, "../assets/motivation.png");
const TEMP_WEBP_PATH = path.join(__dirname, "../assets/temp_motivation_cron.webp");

// ID Target
const TARGET_GROUP_ID = "120363421309923905@g.us";

module.exports = (bot) => {
  // JADWAL: Jam 00:00 WIB Setiap Hari
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON-MOTIVATION] 🔄 Mengirim motivasi tengah malam...');
    
    try {
      if (!fs.existsSync(IMAGE_PATH)) {
        console.error(`[CRON-MOTIVATION] ❌ Gagal: File gambar tidak ditemukan.`);
        return;
      }

      // 1. KONVERSI GAMBAR KE WEBP
      const ffmpegArgs = [
        "-i", IMAGE_PATH,
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=0x00000000",
        "-vcodec", "libwebp",
        "-lossless", "1",
        "-preset", "default",
        "-loop", "0",
        "-an",
        "-vsync", "0",
        "-y", 
        TEMP_WEBP_PATH
      ];

      const run = spawnSync("ffmpeg", ffmpegArgs);

      if (run.error || !fs.existsSync(TEMP_WEBP_PATH)) {
          console.error("[CRON-MOTIVATION] Gagal konversi stiker.");
          await bot.sock.sendMessage(TARGET_GROUP_ID, { text: "⚠️ Gagal memproses stiker motivasi." });
          return;
      }

      // 2. BACA FILE WEBP
      const stickerBuffer = fs.readFileSync(TEMP_WEBP_PATH);
      
      // 3. Pesan Teks (Update untuk Tengah Malam)
      const message = "🌙 *Selamat Malam!* 🌙\n\nHari baru telah dimulai. Jangan lupa istirahat yang cukup agar besok segar kembali! 💤✨\n_#MidnightMotivation_";

      // 4. KIRIM PESAN & STIKER
      await bot.sock.sendMessage(TARGET_GROUP_ID, { text: message });
      await bot.sock.sendMessage(TARGET_GROUP_ID, { sticker: stickerBuffer });

      console.log(`[CRON-MOTIVATION] ✅ Sukses kirim ke Grup ${TARGET_GROUP_ID}`);

      // 5. BERSIHKAN FILE TEMP
      fs.unlinkSync(TEMP_WEBP_PATH);

    } catch (err) {
      console.error("[CRON-MOTIVATION] Error:", err);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ [CRON] Motivation Sender (Jadwal: 00:00) loaded.");
};