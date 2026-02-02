// src/cron/motivationSender.js
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

// Folder Motivations
const MOTIVATION_DIR = path.join(__dirname, "../assets/motivations");
const TEMP_PREFIX = "temp_motivation_";

module.exports = (bot) => {
  // JADWAL: Jam 00:00 WIB Setiap Hari
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON-MOTIVATION] 🔄 Mengirim motivasi tengah malam...');

    try {
      // 1. Ambil semua kelas yang terdaftar
      const classes = await bot.db.prisma.class.findMany({
        select: { mainGroupId: true, name: true }
      });

      if (classes.length === 0) {
        console.log("[CRON-MOTIVATION] Tidak ada kelas terdaftar.");
        return;
      }

      console.log(`[CRON-MOTIVATION] Mengirim ke ${classes.length} kelas...`);

      // Ambil list file di folder motivations
      if (!fs.existsSync(MOTIVATION_DIR)) {
        console.error(`[CRON-MOTIVATION] Folder assets/motivations tidak ditemukan!`);
        return;
      }

      const files = fs.readdirSync(MOTIVATION_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
      if (files.length === 0) {
        console.error(`[CRON-MOTIVATION] Folder assets/motivations kosong!`);
        return;
      }

      // Generate Text AI Sekali saja untuk efisiensi (atau per kelas jika mau beda-beda, tapi efisiensi lebih baik sekali)
      // Request user: "pilih acak untuk setiap kelas" -> gambar beda, teks mungkin sama gapapa? 
      // User says "untuk gambar motivasi itu ada di folder... pilih acak untuk setiap kelas".
      // Teks AI saya buat sekali generate saja untuk semua biar konsisten "Tema Hari Ini".

      let messageText = "🌙 *Selamat Malam!* 🌙\n\nHari baru telah dimulai. Jangan lupa istirahat yang cukup agar besok segar kembali! 💤✨\n_#MidnightMotivation_";

      if (bot.model) {
        try {
          const aiPrompt = "Buatkan SATU quotes motivasi malam singkat (maks 2 kalimat) yang ngena/deep buat mahasiswa yang baru mau tidur. Tema: Semangat belajar, masa depan, rest is productive. HANYA OUTPUT TEKS QOUTES SAJA. Jangan ada pembuka 'Ini pilihannya' dll. Format: 'Kata-kata mutiara. (Emoji)' akhiri dengan baris baru dan hashtag #MidnightMotivation. Jangan pakai tanda petik.";
          const result = await bot.model.generateContent(aiPrompt);
          const aiText = result.response.text().trim();
          if (aiText) messageText = `🌙 *Midnight Motivation* 🌙\n\n${aiText.replace(/^["']|["']$/g, '')}`;
        } catch (e) {
          console.error("[CRON-MOTIVATION] Gagal AI Gen:", e.message);
        }
      }

      // Loop setiap kelas
      for (const cls of classes) {
        if (!cls.mainGroupId) continue;

        try {
          // Pilih Random Image
          const randomFile = files[Math.floor(Math.random() * files.length)];
          const inputPath = path.join(MOTIVATION_DIR, randomFile);
          const tempWebP = path.join(__dirname, `../assets/${TEMP_PREFIX}${cls.mainGroupId}.webp`);

          // Convert ke Sticker (Crop/Scale)
          const ffmpegArgs = [
            "-i", inputPath,
            "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=0x00000000",
            "-vcodec", "libwebp",
            "-lossless", "1",
            "-preset", "default",
            "-loop", "0",
            "-an",
            "-vsync", "0",
            "-y",
            tempWebP
          ];

          const run = spawnSync(ffmpegPath, ffmpegArgs);
          if (run.error || !fs.existsSync(tempWebP)) {
            console.error(`[CRON-MOTIVATION] Gagal convert untuk ${cls.name}:`, run.stderr?.toString());
            // Kirim pesan teks saja jika gagal sticker
            await bot.sock.sendMessage(cls.mainGroupId, { text: messageText });
          } else {
            // Kirim Sticker + Text
            const stickerBuffer = fs.readFileSync(tempWebP);
            await bot.sock.sendMessage(cls.mainGroupId, { text: messageText });
            await bot.sock.sendMessage(cls.mainGroupId, { sticker: stickerBuffer });

            // Cleanup temp
            fs.unlinkSync(tempWebP);
          }

          console.log(`[CRON-MOTIVATION] ✅ Sukses kirim ke ${cls.name} (${cls.mainGroupId})`);

          // Delay kecil biar ga spamming banget
          await new Promise(r => setTimeout(r, 2000));

        } catch (errLoop) {
          console.error(`[CRON-MOTIVATION] Error sending to ${cls.name}:`, errLoop.message);
        }
      }

    } catch (err) {
      console.error("[CRON-MOTIVATION] Error:", err);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ [CRON] Motivation Sender (Jadwal: 00:00) loaded.");
};