// src/commands/tugas/addTaskAI.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');
if (!fs.existsSync(MEDIA_DIR)) { fs.mkdirSync(MEDIA_DIR, { recursive: true }); }

// Utility untuk parsing waktu WIB
const parseWIB = (timeStr) => {
    const isoStart = timeStr.replace(" ", "T") + ":00+07:00"; 
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

module.exports = {
  name: "#add-task-ai",
  description: "Tambah tugas via AI. Reply gambar untuk OCR atau Lampiran (--lampiran).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;
    const userNumber = sender.split("@")[0];

    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif." });
    if (!from.endsWith("@g.us")) return;

    let inputData = text.replace("#add-task-ai", "").trim();
    
    // --- DETEKSI MODE LAMPIRAN ---
    const isAttachmentMode = inputData.includes("--lampiran") || inputData.includes("--attach");
    // Bersihkan flag dari teks input agar tidak membingungkan AI
    inputData = inputData.replace("--lampiran", "").replace("--attach", "").trim();

    let attachmentData = null;
    let mimeType = "text/plain";
    let mediaBuffer = null; // Buffer untuk AI analysis (jika bukan lampiran)

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    // 1. Deteksi Media (Gambar/Dokumen)
    if (quotedMsg) {
        const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage'];
        const mediaType = mediaKeys.find(key => quotedMsg[key]);
        
        if (mediaType) {
             const mediaMessage = quotedMsg[mediaType];
             
             // Download Media
             const stream = await downloadMediaMessage(
                { key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            // SKENARIO A: MODE LAMPIRAN (Simpan File, Jangan Kirim ke AI)
            if (isAttachmentMode) {
                const extension = mediaMessage.mimetype.split('/')[1] || 'bin';
                const timestamp = Date.now();
                const fileName = `${timestamp}_ai_${mediaMessage.fileSha256?.toString('hex').substring(0, 8)}.${extension}`;
                const localFilePath = path.join(MEDIA_DIR, fileName);
                
                fs.writeFileSync(localFilePath, stream); // Simpan fisik

                attachmentData = JSON.stringify({
                    type: mediaType,
                    mimetype: mediaMessage.mimetype,
                    localFilePath: localFilePath, // Simpan path lokal
                    mediaKey: mediaMessage.mediaKey?.toString('base64'),
                    fileSha256: mediaMessage.fileSha256?.toString('base64'),
                });
            } 
            // SKENARIO B: MODE ANALISIS AI (Kirim Buffer ke AI, Jangan Simpan Fisik)
            else {
                mediaBuffer = stream; // Simpan ke variabel untuk dikirim ke Gemini nanti
                mimeType = mediaMessage.mimetype; // Simpan mimetype asli
            }
        }
    } 
    
    if (inputData.length < 5 && !mediaBuffer) {
        return sock.sendMessage(from, { 
            text: "⚠️ Beri deskripsi tugas atau reply gambar soal.\n\n*Tips:* Gunakan `--lampiran` jika gambar yang di-reply adalah file tugas, bukan soal untuk dibaca AI." 
        });
    }

    try {
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // 2. Ambil Kelas dan Subjects
      const kelas = await db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
      });

      if (!kelas || kelas.semesters.length === 0) return sock.sendMessage(from, { text: "❌ Kelas/Semester belum siap." });
      const subjectsList = kelas.semesters[0].subjects.map(s => s.name).join(", ");
      
      const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).replace(/\//g, '-');
      const currentYear = new Date().getFullYear(); 

      // 3. Prompting Gemini
      const systemPrompt = `
      Anda adalah Task Extractor. Tugas Anda adalah menganalisis input dan mengekstrak detailnya ke format JSON.
      
      Aturan Ekstraksi:
      - Mapel dari: [${subjectsList}].
      - Hari Ini: ${todayWIB} WIB. TAHUN AKTIF: ${currentYear}.
      - Deadline: YYYY-MM-DD HH:mm (Wajib ${currentYear}). Asumsikan 23:59 jika jam hilang.
      - Tipe Tugas: Tentukan INDIVIDU (false) atau KELOMPOK (true).

      Outputkan HANYA objek JSON.
      { "mapel": "Nama Mapel", "judul": "Judul Tugas", "deadline": "YYYY-MM-DD HH:mm", "isGroupTask": true/false, "link": "URL Tugas atau '-'" }
      `;
      
      const contentParts = [{ text: systemPrompt }];

      // INJEKSI INPUT KE AI
      if (mediaBuffer) {
          // Jika mode Analisis, kirim gambar ke AI
          contentParts.push({ text: `Ekstrak tugas dari gambar ini.` });
          contentParts.push({ inlineData: { mimeType: mimeType, data: mediaBuffer.toString('base64') } });
          if (inputData) contentParts.push({ text: `Catatan tambahan: ${inputData}` });
      } else {
          // Jika mode Teks (atau Lampiran), hanya kirim teks deskripsi
          contentParts.push({ text: `Deskripsi Teks: ${inputData}` });
      }
      
      const contents = [{ role: "user", parts: contentParts }];
      
      const result = await model.generateContent({ contents });
      let jsonText = result.response.text().trim().replace(/```json|```/g, "").trim();
      const taskData = JSON.parse(jsonText);

      // 4. Validasi & Simpan
      let { mapel, judul, deadline, isGroupTask, link } = taskData;
      const parsedDeadline = parseWIB(deadline);
      const finalMapel = subjectsList.split(',').map(s => s.trim()).find(s => mapel.toLowerCase().includes(s.toLowerCase()));

      const missingFields = [];
      if (!finalMapel) missingFields.push("mapel");
      if (!judul || judul === "-") missingFields.push("judul");
      if (!parsedDeadline) missingFields.push("deadline");

      // Simpan Data (Sertakan attachmentData jika ada)
      if (missingFields.length === 0) {
        const newTask = await db.prisma.task.create({
          data: {
            classId: kelas.id, 
            mapel: finalMapel, 
            judul, 
            deadline: parsedDeadline, 
            isGroupTask: isGroupTask, 
            link: link || "-", 
            attachmentData: attachmentData, // <--- SIMPAN DATA LAMPIRAN (JIKA ADA)
          }
        });
        
        let successText = `✨ *TUGAS TERSIMPAN VIA AI* ✨\n\n📚 Mapel: ${newTask.mapel}\n📅 Deadline: ${newTask.deadline.toLocaleString("id-ID")}\n`;
        if (attachmentData) successText += `📎 _Lampiran tersimpan._\n`;
        
        return sock.sendMessage(from, { text: successText, mentions: [sender] });

      } else {
        // Fallback ke Sesi Interaktif
        const sessions = bot.sessions;
        const startStep = missingFields.includes("mapel") ? 1 : 2; 

        sessions.set(sender, {
          type: "ADD_TASK", groupId: from, classId: kelas.id,
          step: startStep, 
          data: { 
            attachmentData, // Teruskan lampiran ke sesi manual
            mapel: finalMapel || null, judul, deadline: parsedDeadline, isGroupTask, link
          }
        });

        const listMapel = kelas.semesters[0].subjects.map((s, i) => `*${i + 1}.* ${s.name}`).join("\n");
        const promptText = missingFields.includes("mapel") 
            ? `⚠️ AI bingung mapelnya. Pilih nomor:\n\n${listMapel}` 
            : `⚠️ AI bingung judul/deadline. Input *JUDUL* tugas:`;

        await sock.sendMessage(from, { text: promptText });
      }

    } catch (e) {
      console.error("Error addTaskAI:", e);
      await sock.sendMessage(from, { text: `❌ Gagal menyimpan tugas via AI. Error: ${e.message}` });
    }
  }
};