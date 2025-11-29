const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

module.exports = {
  name: "#stiker",
  description: "Membuat stiker (Transparan + Text Support).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock } = bot;

    let mediaMessage = null;
    let mediaType = null;
    
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      if (quoted.imageMessage) { mediaMessage = quoted.imageMessage; mediaType = "image"; } 
      else if (quoted.videoMessage) { mediaMessage = quoted.videoMessage; mediaType = "video"; }
    } else {
      if (msg.message?.imageMessage) { mediaMessage = msg.message.imageMessage; mediaType = "image"; } 
      else if (msg.message?.videoMessage) { mediaMessage = msg.message.videoMessage; mediaType = "video"; }
    }

    if (!mediaMessage) return await sock.sendMessage(from, { text: "❗ Kirim/Reply media dengan caption *#stiker*." });
    if (mediaType === "video" && (mediaMessage.seconds > 10)) return await sock.sendMessage(from, { text: "❗ Video maks 10 detik." });

    await sock.sendMessage(from, { text: "⏳ Sedang diproses..." }, { quoted: msg });

    const timestamp = Date.now();
    const inputExt = mediaType === "video" ? "mp4" : "jpeg";
    const inputFile = path.join(process.cwd(), `temp_${timestamp}.${inputExt}`);
    const outputFile = path.join(process.cwd(), `temp_${timestamp}.webp`);

    try {
      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      fs.writeFileSync(inputFile, buffer);

      const stickerText = args.join(" ").trim();
      
      // LOGIKA FILTER UTAMA
      let vf = `fps=15,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000`;

      // --- LOGIKA TEXT & EMOJI ---
      if (stickerText) {
        // ⚠️ PENTING: Ganti path ini ke font yang support emoji (Misal: NotoEmoji-Regular.ttf)
        // Jika tetap pakai Roboto, emoji akan hilang/jadi kotak.
        // Download di: https://fonts.google.com/noto/specimen/Noto+Emoji
        const fontPath = path.join(__dirname, "../../fonts/NotoEmoji-Regular.ttf"); 
        
        // Fallback jika font Noto tidak ada, pakai Roboto (tapi emoji hilang)
        const fallbackFont = path.join(__dirname, "../../fonts/Roboto/static/Roboto_SemiCondensed-Light.ttf");
        const finalFont = fs.existsSync(fontPath) ? fontPath : fallbackFont;

        if (fs.existsSync(finalFont)) {
            const escapedFontPath = finalFont.replace(/\\/g, '/').replace(/:/g, '\\:');
            
            // Escape karakter khusus FFmpeg
            // Emoji aman dilewatkan asalkan Font mendukungnya
            const safeText = stickerText
                .replace(/\\/g, '\\\\')
                .replace(/:/g, '\\:')
                .replace(/'/g, ''); 

            // fontsize=35, borderw=2 (Stroke Hitam)
            vf += `,drawtext=text='${safeText}':fontfile='${escapedFontPath}':fontsize=35:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)-15`;
        }
      }

      const ffmpegArgs = [
        "-i", inputFile,
        "-vcodec", "libwebp",
        "-vf", vf,
        "-lossless", "0",
        "-compression_level", "4",
        "-q:v", "50",
        "-loop", "0",
        "-an",
        "-vsync", "0",
        "-preset", "default",
        outputFile
      ];

      const result = spawnSync("ffmpeg", ffmpegArgs);

      if (result.error) throw result.error;
      if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size === 0) {
         throw new Error("Gagal convert media.");
      }

      await sock.sendMessage(from, { sticker: fs.readFileSync(outputFile) }, { quoted: msg });

    } catch (err) {
      console.error("Sticker error:", err);
      await sock.sendMessage(from, { text: "❌ Gagal membuat stiker." });
    } finally {
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (e) {}
    }
  },
};