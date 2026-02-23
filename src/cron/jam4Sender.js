const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

// Folder Jam 4
const JAM4_DIR = path.join(__dirname, "../assets/jam4");
const TEMP_PREFIX = "temp_jam4_";

// Logic Constants
const SPECIAL_GROUP_ID = "120363421309923905@g.us";
const SPECIAL_IMAGE = "bowok.png";

module.exports = (bot) => {
  // JADWAL PRODUKSI: Jam 04:00 dan 16:00 WIB
  cron.schedule('0 4,16 * * *', async () => {
    console.log('[CRON-JAM4] 🔄 Memulai rutinitas jam 4...');

    try {
      // 1. Ambil semua kelas
      const classes = await bot.db.prisma.class.findMany({
        where: { mainGroupId: SPECIAL_GROUP_ID },
        select: { mainGroupId: true, name: true }
      });
      if (classes.length === 0) {
        console.log("[CRON-JAM4] Tidak ada kelas terdaftar.");
        return;
      }

      // 2. Cek Folder Gambar
      if (!fs.existsSync(JAM4_DIR)) {
        console.error(`[CRON-JAM4] ❌ Gagal: Folder gambar tidak ditemukan di ${JAM4_DIR}`);
        return;
      }

      const allFiles = fs.readdirSync(JAM4_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
      if (allFiles.length === 0) {
        console.error("[CRON-JAM4] Folder jam4 kosong.");
        return;
      }

      // 3. Generate Pesan Teks (Dynamic AI / Fallback) - Generate Once
      const hourStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: 'numeric', hour12: false });
      const currentHour = parseInt(hourStr);

      let message = "🕒 *Jam 4!*";
      let staticMessage = message;
      let aiPrompt = "";

      if (currentHour === 4) {
        staticMessage = "🌅 *Jam 4 Pagi!* Waktunya bangun, sholat subuh, atau lanjut tidur? 😴";
        aiPrompt = "Buatkan SATU ucapan jam 4 pagi yang lucu, singkat (maks 1 kalimat), sangat casual/gaul khas mahasiswa Indonesia. Ajak bangun atau sindir yang masih begadang. HANYA OUTPUT TEKS UCAPAN SAJA. Jangan ada pembuka/penutup formal. Contoh style: 'Woi bangun udah subuh, jangan ngebo mulu!'";
      } else if (currentHour === 16) {
        staticMessage = "🌇 *Jam 4 Sore!* Waktunya santai sejenak, ngopi, atau pulang kuliah ☕";
        aiPrompt = "Buatkan SATU ucapan jam 4 sore yang santai, lucu, singkat (maks 1 kalimat), sangat casual/gaul khas mahasiswa Indonesia. Tema: capek kuliah, butuh kopi, atau OTW pulang. HANYA OUTPUT TEKS UCAPAN SAJA. Jangan ada pembuka/penutup formal. Contoh style: 'Jam segini enaknya ngopi nih, skripsi pikir ntar aja.'";
      }

      if (bot.model && aiPrompt) {
        try {
          const result = await bot.model.generateContent(aiPrompt);
          const aiText = result.response.text().trim();
          // Remove quotas/markdown if accidentally added by AI
          const cleanText = aiText.replace(/^["']|["']$/g, '').replace(/\*\*/g, '*');
          const header = (currentHour === 4) ? "🌅 *Early Bird Check!*" : "☕ *Coffee Time!*";
          message = cleanText ? `${header}\n\n${cleanText}` : staticMessage;
        } catch (e) {
          console.error("[CRON-JAM4] Gagal generate teks AI:", e.message);
          message = staticMessage;
        }
      } else {
        message = staticMessage;
      }

      // 4. LOOP KIRIM KE SEMUA KELAS
      console.log(`[CRON-JAM4] Mengirim ke ${classes.length} kelas...`);
      for (const cls of classes) {
        if (!cls.mainGroupId) continue;

        try {
          // Determine Image
          let chosenFile;
          if (cls.mainGroupId === SPECIAL_GROUP_ID) {
            chosenFile = SPECIAL_IMAGE;
            // Verify exist
            if (!allFiles.includes(chosenFile)) {
              console.warn(`[CRON-JAM4] Special image ${SPECIAL_IMAGE} not found, using random.`);
              chosenFile = null;
            }
          } else {
            // Random excluding special image
            const availableFiles = allFiles.filter(f => f !== SPECIAL_IMAGE);
            if (availableFiles.length > 0) {
              chosenFile = availableFiles[Math.floor(Math.random() * availableFiles.length)];
            }
          }

          // Fallback if filtering result empty or special missing logic fallthrough
          if (!chosenFile) {
            chosenFile = allFiles[Math.floor(Math.random() * allFiles.length)];
          }

          const inputPath = path.join(JAM4_DIR, chosenFile);
          const tempWebP = path.join(__dirname, `../assets/${TEMP_PREFIX}${cls.mainGroupId}.webp`);

          // Convert to Sticker
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
            console.error(`[CRON-JAM4] Fail convert ${chosenFile} for ${cls.name}`);
            await bot.sock.sendMessage(cls.mainGroupId, { text: message }); // Send text only
          } else {
            const stickerBuffer = fs.readFileSync(tempWebP);
            await bot.sock.sendMessage(cls.mainGroupId, { text: message });
            await bot.sock.sendMessage(cls.mainGroupId, { sticker: stickerBuffer });

            fs.unlinkSync(tempWebP);
          }

          console.log(`[CRON-JAM4] ✅ Sent to ${cls.name} (${chosenFile})`);
          await new Promise(r => setTimeout(r, 1000)); // Delay

        } catch (e) {
          console.error(`[CRON-JAM4] Gagal kirim ke ${cls.name}:`, e.message);
        }
      }

    } catch (err) {
      console.error("[CRON-JAM4] Error:", err);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log("✅ [CRON] Jam 4 Sender (Jadwal: 04:00 & 16:00) loaded.");
};