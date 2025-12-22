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

    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

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

      if (stickerText) {

        const fontPath = path.join(__dirname, "../../fonts/NotoEmoji-Regular.ttf");

        // Fallback jika font Noto tidak ada, pakai Roboto (tapi emoji hilang)
        const fallbackFont = path.join(__dirname, "../../fonts/Roboto/static/Roboto_SemiCondensed-Light.ttf");
        const finalFont = fs.existsSync(fontPath) ? fontPath : fallbackFont;

        if (fs.existsSync(finalFont)) {
          const escapedFontPath = finalFont.replace(/\\/g, '/').replace(/:/g, '\\:');
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

      // Success reaction
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

      // Delete user's message (Bot must be admin)
      try {
        await sock.sendMessage(from, { delete: msg.key });
      } catch (deleteErr) {
        // Ignored if bot is not admin or cannot delete
      }

    } catch (err) {
      console.error("Sticker error:", err);
      try {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
      } catch (e) { }
      await sock.sendMessage(from, { text: "❌ Gagal membuat stiker." });
    } finally {
      try {
        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
      } catch (e) { }
    }
  },
};