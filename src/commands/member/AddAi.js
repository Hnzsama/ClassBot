// src/commands/member/addAi.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { addMembersToDb } = require('./add'); 

module.exports = {
  name: "#add-member-ai",
  description: "Tambah member via AI (Teks atau Reply Gambar list).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!from.endsWith("@g.us")) return;
    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif." });
    
    let inputData = text.replace("#add-member-ai", "").trim();
    let mimeType = "text/plain";
    
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (quotedMsg && (quotedMsg.imageMessage || quotedMsg.documentMessage)) {
        mimeType = quotedMsg.imageMessage ? 'image/jpeg' : 'application/pdf'; 
        inputData = await downloadMediaMessage(
            { key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
            'buffer',
            { },
            { reuploadRequest: sock.updateMediaMessage }
        );
    } else if (inputData.length < 15) {
        return sock.sendMessage(from, { text: "⚠️ Beri deskripsi atau reply gambar yang berisi daftar member." });
    }

    try {
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // FIX: Dual Group Check
      const kelas = await db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 3. Prompting Gemini
      const systemPrompt = `
      Anda adalah Data Extractor yang bertugas mengekstrak daftar mahasiswa dari input (gambar atau teks).
      
      Aturan Ekstraksi:
      1. Cari NIM, Nama Lengkap, dan Nama Panggilan.
      2. Jika Panggilan tidak ada, gunakan Nama Lengkap.
      3. Pastikan NIM berupa angka.

      Outputkan HANYA ARRAY JSON valid.
      [
        { "nim": "NIM string", "nama": "Nama Lengkap", "panggilan": "Panggilan Singkat" }
      ]
      `;
      
      const contents = [{ role: "user", parts: [{ text: systemPrompt }] }];
      if (Buffer.isBuffer(inputData)) {
          contents[0].parts.push({ text: `Ekstrak daftar member dari media berikut.` });
          contents[0].parts.push({ inlineData: { mimeType: mimeType, data: inputData.toString('base64') } });
      } else {
          contents[0].parts.push({ text: `Daftar Teks: ${inputData}` });
      }
      
      const result = await model.generateContent({ contents });
      let jsonText = result.response.text().trim().replace(/```json|```/g, "").trim();
      
      let rawDataArray;
      try {
        rawDataArray = JSON.parse(jsonText);
      } catch (e) {
        return sock.sendMessage(from, { text: "❌ AI Gagal parsing data. Pastikan gambar jelas." });
      }

      // 4. Konversi ke format processor
      const linesForProcessor = [];
      
      rawDataArray.forEach(data => {
          if (data.nim && data.nama) {
              linesForProcessor.push(`${data.nim} | ${data.nama} | ${data.panggilan || ''}`);
          }
      });

      if (linesForProcessor.length === 0) {
          return sock.sendMessage(from, { text: `❌ Data tidak valid atau kosong.` });
      }

      return addMembersToDb(bot, from, sender, linesForProcessor, kelas.id, kelas.name, true);

    } catch (e) {
      console.error("Error add-member-ai:", e);
      await sock.sendMessage(from, { text: `❌ Gagal memproses data via AI. Error: ${e.message}` });
    }
  }
};