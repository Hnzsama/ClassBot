const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Lokasi gambar sumber (PNG/JPG)
const IMAGE_PATH = path.join(__dirname, "../assets/jam4.png");
// Lokasi sementara untuk output WebP
const TEMP_WEBP_PATH = path.join(__dirname, "../assets/temp_jam4_cron.webp");

// ID Target: GRUP UTAMA
const TARGET_GROUP_ID = "120363421309923905@g.us";

module.exports = (bot) => {
  // JADWAL PRODUKSI: Jam 04:00 dan 16:00 WIB
  cron.schedule('0 4,16 * * *', async () => {
    console.log('[CRON-JAM4] 🔄 Memulai rutinitas jam 4...');
    
    try {
      // 1. Cek File Gambar
      if (!fs.existsSync(IMAGE_PATH)) {
        console.error(`[CRON-JAM4] ❌ Gagal: File gambar tidak ditemukan di ${IMAGE_PATH}`);
        return;
      }

      // 2. KONVERSI GAMBAR KE WEBP (FFMPEG)
      // Memastikan gambar menjadi stiker yang valid (512x512, WebP)
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
          console.error("[CRON-JAM4] Gagal konversi stiker:", run.stderr?.toString());
          // Fallback: Kirim pesan teks saja
          await bot.sock.sendMessage(TARGET_GROUP_ID, { 
              text: "⚠️ Gagal memproses stiker jam 4."
          });
          return;
      }

      // 3. BACA FILE WEBP HASIL KONVERSI
      const stickerBuffer = fs.readFileSync(TEMP_WEBP_PATH);
      
      // 4. Tentukan Pesan Teks (Pagi/Sore)
      const hourStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: 'numeric', hour12: false });
      const currentHour = parseInt(hourStr);

      let message = "🕒 *Jam 4!*";
      if (currentHour === 4) {
          message = "🌅 *Jam 4 Pagi!* Waktunya bangun, sholat subuh, atau lanjut tidur? 😴";
      } else if (currentHour === 16) {
          message = "🌇 *Jam 4 Sore!* Waktunya santai sejenak, ngopi, atau pulang kuliah ☕";
      }

      // 5. KIRIM PESAN & STIKER
      await bot.sock.sendMessage(TARGET_GROUP_ID, { text: message });
      await bot.sock.sendMessage(TARGET_GROUP_ID, { sticker: stickerBuffer });

      console.log(`[CRON-JAM4] ✅ Sukses kirim ke Grup ${TARGET_GROUP_ID}`);

      // 6. BERSIHKAN FILE TEMP
      if (fs.existsSync(TEMP_WEBP_PATH)) {
        fs.unlinkSync(TEMP_WEBP_PATH);
      }

    } catch (err) {
      console.error("[CRON-JAM4] Error:", err);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ [CRON] Jam 4 Stiker Sender (Jadwal: 04:00 & 16:00) loaded.");
};