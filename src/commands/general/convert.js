// commands/convert.js
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const mime = require("mime-types");

// --- PENYIMPANAN SEMENTARA UNTUK BATCH ---
// Map<SenderJid, Array<FilePath>>
const batchStorage = new Map();

// Fungsi helper untuk menjalankan perintah terminal (LibreOffice)
const execPromise = (command) =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });

// Fungsi untuk membuka bungkusan pesan (Unwrap message)
// Ini memperbaiki error saat media dikirim sebagai viewOnce atau album
const unwrapMessage = (msg) => {
  if (!msg.message) return null;
  let m = msg.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  return m;
};

module.exports = {
  name: "#convert",
  description: "Konversi file (Img/Docx -> PDF, PDF -> Docx)",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock } = bot;

    // 1. PARSING ARGUMEN
    // Format: #convert [mode] [nama_output]
    // Mode valid: topdf, todocx, add, reset
    let mode = args[0] ? args[0].toLowerCase() : null;
    let outputName = args.slice(1).join(" "); // Ambil sisa argumen sebagai nama

    // Jika user mengetik langsung #topdf atau #todocx (karena alias di index.js)
    const commandUsed = text.split(" ")[0].toLowerCase();
    if (commandUsed.includes("topdf")) mode = "topdf";
    if (commandUsed.includes("todocx")) mode = "todocx";

    if (!["topdf", "todocx", "add", "reset"].includes(mode)) {
      await sock.sendMessage(from, {
        text: `⚠️ *Mode tidak dikenali.*\n\nGunakan:\n- *#convert topdf [nama]* (Ubah ke PDF)\n- *#convert todocx* (Ubah ke Word)\n- *#convert add* (Tambah gambar ke antrean PDF)\n- *#convert reset* (Hapus antrean)`,
      });
      return;
    }

    // 2. LOGIKA RESET & ADD (BATCHING)
    if (mode === "reset") {
      if (batchStorage.has(sender)) {
        // Hapus file fisik
        batchStorage.get(sender).forEach((f) => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
        batchStorage.delete(sender);
      }
      await sock.sendMessage(from, { text: "🗑️ Antrean file berhasil dikosongkan." });
      return;
    }

    // Cek Media pada pesan saat ini (Reply atau Kiriman langsung)
    const content = unwrapMessage(msg);
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const targetMsg = quoted ? unwrapMessage({ message: quoted }) : content;

    let type = null;
    let mediaMsg = null;

    if (targetMsg?.imageMessage) {
      type = "image";
      mediaMsg = targetMsg.imageMessage;
    } else if (targetMsg?.documentMessage) {
      type = "document";
      mediaMsg = targetMsg.documentMessage;
    }

    // === MODE ADD (UNTUK MULTIPLE GAMBAR) ===
    if (mode === "add") {
      if (!type) {
        await sock.sendMessage(from, { text: "❌ Harap kirim atau reply gambar/dokumen untuk ditambahkan." });
        return;
      }
      
      try {
        const stream = await downloadContentFromMessage(mediaMsg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        const tempDir = path.join(__dirname, "../temp_batch");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const ext = mime.extension(mediaMsg.mimetype) || "bin";
        const tempFile = path.join(tempDir, `${Date.now()}_${sender.split('@')[0]}.${ext}`);
        fs.writeFileSync(tempFile, buffer);

        // Simpan ke map
        if (!batchStorage.has(sender)) batchStorage.set(sender, []);
        batchStorage.get(sender).push(tempFile);

        const count = batchStorage.get(sender).length;
        await sock.sendMessage(from, { text: `✅ File ditambahkan! Total antrean: ${count} file.\nKetik *#convert topdf [nama]* untuk jadikan satu PDF.` });
      } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: "❌ Gagal menambahkan file." });
      }
      return;
    }

    // === MODE KONVERSI UTAMA (topdf / todocx) ===
    
    // Cek apakah ada antrean batch atau file langsung
    const batchFiles = batchStorage.get(sender) || [];
    const hasBatch = batchFiles.length > 0;
    const hasDirectFile = !!type;

    if (!hasBatch && !hasDirectFile) {
        await sock.sendMessage(from, { text: "❌ Tidak ada file untuk dikonversi.\nKirim file dengan caption *#convert topdf* atau tambahkan dulu dengan *#convert add*." });
        return;
    }

    await sock.sendMessage(from, { text: "⏳ Sedang memproses konversi..." });

    try {
      const timestamp = Date.now();
      const outputPath = path.join(__dirname, `../`);
      let finalFilePath = null;
      let finalFileName = outputName || `Converted_${timestamp}`;

      // --- LOGIKA DOCX KE PDF ATAU PDF KE DOCX (SINGLE FILE) ---
      // LibreOffice lebih baik menangani satu file per satu waktu
      if (mode === "todocx" || (mode === "topdf" && type === "document" && !hasBatch)) {
        if (!hasDirectFile) {
             throw new Error("Mode ini butuh file langsung (Reply/Caption).");
        }
        
        // Download File Langsung
        const stream = await downloadContentFromMessage(mediaMsg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const inputExt = mime.extension(mediaMsg.mimetype);
        const tempInput = path.join(__dirname, `../temp_${timestamp}.${inputExt}`);
        fs.writeFileSync(tempInput, buffer);

        let convertCmd = "";
        if (mode === "topdf") {
            convertCmd = `libreoffice --headless --convert-to pdf "${tempInput}" --outdir "${outputPath}"`;
            finalFilePath = path.join(outputPath, `temp_${timestamp}.pdf`);
            if (!finalFileName.endsWith(".pdf")) finalFileName += ".pdf";
        } else {
            convertCmd = `libreoffice --headless --infilter="writer_pdf_import" --convert-to docx "${tempInput}" --outdir "${outputPath}"`;
            finalFilePath = path.join(outputPath, `temp_${timestamp}.docx`);
            if (!finalFileName.endsWith(".docx")) finalFileName += ".docx";
        }

        await execPromise(convertCmd);
        fs.unlinkSync(tempInput); // Hapus input
      }

      // --- LOGIKA GAMBAR KE PDF (BISA MULTIPLE/BATCH) ---
      else if (mode === "topdf") {
        const pdfDoc = await PDFDocument.create();
        const imagesToProcess = [...batchFiles]; // Copy antrean

        // Jika ada file langsung di chat saat ini, tambahkan juga (tapi download dulu)
        let directFileTemp = null;
        if (hasDirectFile && type === "image") {
             const stream = await downloadContentFromMessage(mediaMsg, type);
             let buffer = Buffer.from([]);
             for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
             
             directFileTemp = path.join(__dirname, `../temp_direct_${timestamp}.jpg`);
             fs.writeFileSync(directFileTemp, buffer);
             imagesToProcess.push(directFileTemp);
        }

        // Loop semua gambar dan masukkan ke PDF
        for (const imgPath of imagesToProcess) {
            try {
                const imgBuffer = fs.readFileSync(imgPath);
                // Coba embed JPG atau PNG
                let image;
                if (imgPath.endsWith("png")) image = await pdfDoc.embedPng(imgBuffer);
                else image = await pdfDoc.embedJpg(imgBuffer);

                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0, y: 0, width: image.width, height: image.height,
                });
            } catch (err) {
                console.error(`Skip file ${imgPath}:`, err.message);
            }
        }

        const pdfBytes = await pdfDoc.save();
        if (!finalFileName.endsWith(".pdf")) finalFileName += ".pdf";
        finalFilePath = path.join(outputPath, finalFileName);
        fs.writeFileSync(finalFilePath, pdfBytes);

        // Bersihkan file antrean setelah sukses dibuat PDF
        if (directFileTemp && fs.existsSync(directFileTemp)) fs.unlinkSync(directFileTemp);
        batchFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
        batchStorage.delete(sender); // Reset antrean user
      }

      // --- KIRIM HASIL ---
      if (finalFilePath && fs.existsSync(finalFilePath)) {
        await sock.sendMessage(
            from,
            {
                document: fs.readFileSync(finalFilePath),
                mimetype: mode === "topdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                fileName: finalFileName,
                caption: "✅ Konversi Selesai!",
            },
            { quoted: msg }
        );
        fs.unlinkSync(finalFilePath); // Hapus file hasil di server
      } else {
          throw new Error("Gagal membuat file output.");
      }

    } catch (e) {
      console.error("Convert Error:", e);
      await sock.sendMessage(from, { text: `❌ Terjadi kesalahan: ${e.message}` });
    }
  },
};