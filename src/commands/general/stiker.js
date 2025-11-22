const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path"); // 1. Tambahkan 'path'

module.exports = {
  name: "#stiker",
  description: "Membuat stiker dari gambar atau GIF",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock } = bot;

    let mediaMessage = null;
    let mediaType = null;
    let quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quoted) {
      if (quoted.imageMessage) {
        mediaMessage = quoted.imageMessage;
        mediaType = "image";
      } else if (quoted.videoMessage) {
        mediaMessage = quoted.videoMessage;
        mediaType = "video";
      }
    } else {
      if (msg.message?.imageMessage) {
        mediaMessage = msg.message.imageMessage;
        mediaType = "image";
      } else if (msg.message?.videoMessage) {
        mediaMessage = msg.message.videoMessage;
        mediaType = "video";
      }
    }

    if (!mediaMessage) {
      await sock.sendMessage(from, {
        text: "❗ Kirim atau reply gambar/GIF dengan caption *#stiker* atau *#stiker [teks]*.",
      });
      return;
    }

    if (mediaType === "video" && (mediaMessage.seconds || 0) > 10) {
      await sock.sendMessage(from, {
        text: "❗ Video/GIF terlalu panjang. Maksimal 10 detik.",
      });
      return;
    }

    try {
      await sock.sendMessage(from, {
        text: "⏳ Media sedang diproses menjadi stiker...",
      });

      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const input = "temp_input";
      const output = "temp_output.webp";
      fs.writeFileSync(input, buffer);

      // --- 2. LOGIKA BARU UNTUK TEKS DIMULAI DI SINI ---

      // Ambil teks dari argumen (variabel 'text' berisi semua teks setelah '#stiker ')
      const stickerText = args.join(" ").trim();

      // Tentukan path ke file font Anda
      // Pastikan file 'font.ttf' ada di direktori yang sama dengan file ini
      const fontPath = path.join(__dirname, "../fonts/Roboto/static/Roboto_SemiCondensed-Light.ttf");

      // Cek apakah file font ada
      if (stickerText && !fs.existsSync(fontPath)) {
        console.error("File font tidak ditemukan di:", fontPath);
        await sock.sendMessage(from, {
          text: "❌ Gagal membuat stiker: File font (font.ttf) tidak ditemukan.",
        });
        return;
      }
      
      // Sanitasi path untuk ffmpeg (terutama di Windows)
      const escapedFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

      // Filter dasar untuk stiker
      const baseFilters = "scale=512:512:force_original_aspect_ratio=decrease,fps=15,format=rgba,pad=512:512:-1:-1:color=0x00000000";
      
      let finalFilters = baseFilters;

      // Jika ada teks, tambahkan filter drawtext
      if (stickerText) {
        // Sanitasi teks untuk ffmpeg (mengganti ' dengan ’)
        const safeText = stickerText.replace(/'/g, "’");

        const textFilter = `drawtext=text='${safeText}':fontfile='${escapedFontPath}':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-(text_h*1.5)`;
        
        // Gabungkan filter dasar dengan filter teks
        finalFilters = `${baseFilters},${textFilter}`;
      }

      // --- AKHIR DARI LOGIKA BARU ---


      // 3. Modifikasi argumen ffmpeg
      const ffmpegArgs = [
        "-i",
        input,
        "-vf", // Gunakan variabel finalFilters yang sudah dinamis
        finalFilters,
        "-vcodec",
        "libwebp",
        "-lossless",
        "0",
        "-qscale",
        "60",
        "-preset",
        "picture",
        "-loop",
        "0",
        "-an",
        "-vsync",
        "0",
        output,
      ];

      const run = spawnSync("ffmpeg", ffmpegArgs);
      if (run.error) throw run.error;
      
      // Cek apakah output ffmpeg ada error
      if (run.stderr && run.stderr.length > 0) {
        // Tampilkan error stderr jika ada, ini membantu debugging
        console.error("FFMPEG Stderr:", run.stderr.toString());
      }

      await sock.sendMessage(from, {
        sticker: fs.readFileSync(output),
      });

      fs.unlinkSync(input);
      fs.unlinkSync(output);
    } catch (err) {
      console.error("Sticker error:", err);
      await sock.sendMessage(from, {
        text: "❌ Gagal membuat stiker.",
      });
      // Pastikan file sementara dihapus meskipun gagal
      if (fs.existsSync(input)) fs.unlinkSync(input);
      if (fs.existsSync(output)) fs.unlinkSync(output);
    }
  },
};