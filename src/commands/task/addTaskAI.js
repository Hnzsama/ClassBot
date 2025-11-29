// src/commands/tugas/addTaskAI.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');
if (!fs.existsSync(MEDIA_DIR)) { fs.mkdirSync(MEDIA_DIR, { recursive: true }); }

// Utility untuk parsing waktu WIB
const parseWIB = (timeStr) => {
    if (!timeStr) return null;
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
    inputData = inputData.replace("--lampiran", "").replace("--attach", "").trim();

    let attachmentData = null;
    let mimeType = "text/plain";
    let mediaBuffer = null; 

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    // 1. Deteksi Media
    if (quotedMsg) {
        const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage'];
        const mediaType = mediaKeys.find(key => quotedMsg[key]);
        
        if (mediaType) {
             const mediaMessage = quotedMsg[mediaType];
             
             try {
                 const stream = await downloadMediaMessage(
                    { key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
                    'buffer',
                    {},
                    { reuploadRequest: sock.updateMediaMessage }
                );

                if (isAttachmentMode) {
                    const extension = mediaMessage.mimetype.split('/')[1] || 'bin';
                    const fName = `${Date.now()}_ai_${mediaMessage.fileSha256?.toString('hex').substring(0, 8)}.${extension}`;
                    const localFilePath = path.join(MEDIA_DIR, fName);
                    fs.writeFileSync(localFilePath, stream);

                    attachmentData = JSON.stringify({
                        type: mediaType,
                        mimetype: mediaMessage.mimetype,
                        localFilePath: localFilePath,
                        mediaKey: mediaMessage.mediaKey?.toString('base64'),
                        fileSha256: mediaMessage.fileSha256?.toString('base64'),
                    });
                } else {
                    mediaBuffer = stream; 
                    mimeType = mediaMessage.mimetype; 
                }
             } catch (e) {
                 return sock.sendMessage(from, { text: "❌ Gagal download media." });
             }
        }
    } 
    
    if (inputData.length < 5 && !mediaBuffer) {
        return sock.sendMessage(from, { 
            text: "⚠️ *AI TASK SCANNNER*\n\nKirim deskripsi atau reply gambar soal.\n\n📝 *Contoh:* \"Tugas Matematika bab 3 deadline besok\"\n📎 *Lampiran:* Tambahkan `--lampiran` jika ingin menyimpan file yang di-reply." 
        });
    }

    try {
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // 2. Ambil Kelas
      const kelas = await db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
      });

      if (!kelas || kelas.semesters.length === 0) return sock.sendMessage(from, { text: "❌ Kelas belum siap (Mapel/Semester kosong)." });
      const subjectsList = kelas.semesters[0].subjects.map(s => s.name).join(", ");
      
      const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).replace(/\//g, '-');
      const currentYear = new Date().getFullYear(); 

      // 3. Prompting Gemini
      const systemPrompt = `
      Anda adalah Task Extractor. Tugas: Ekstrak detail tugas ke format JSON.
      
      Konteks:
      - Mapel Valid: [${subjectsList}].
      - Hari Ini: ${todayWIB}. Tahun: ${currentYear}.
      - Deadline: YYYY-MM-DD HH:mm. (Jika user bilang "Besok", hitung tanggalnya).
      
      Output JSON Only:
      { "mapel": "Nama Mapel", "judul": "Judul Tugas", "deadline": "YYYY-MM-DD HH:mm", "isGroupTask": true/false, "link": "URL/-" }
      `;
      
      const contentParts = [{ text: systemPrompt }];

      if (mediaBuffer) {
          contentParts.push({ text: `Ekstrak dari gambar ini.` });
          contentParts.push({ inlineData: { mimeType: mimeType, data: mediaBuffer.toString('base64') } });
          if (inputData) contentParts.push({ text: `Catatan: ${inputData}` });
      } else {
          contentParts.push({ text: `Input: ${inputData}` });
      }
      
      const contents = [{ role: "user", parts: contentParts }];
      const result = await model.generateContent({ contents });
      
      let jsonText = result.response.text().trim();
      // Bersihkan markdown code block jika ada
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
      
      let taskData;
      try {
          taskData = JSON.parse(jsonText);
      } catch (e) {
          return sock.sendMessage(from, { text: "❌ AI bingung membaca respon." });
      }

      // 4. Validasi & Simpan
      let { mapel, judul, deadline, isGroupTask, link } = taskData;
      const parsedDeadline = parseWIB(deadline);
      const finalMapel = subjectsList.split(',').map(s => s.trim()).find(s => mapel && s.toLowerCase().includes(mapel.toLowerCase()));

      const missingFields = [];
      if (!finalMapel) missingFields.push("mapel");
      if (!judul || judul === "-") missingFields.push("judul");
      if (!parsedDeadline) missingFields.push("deadline");

      if (missingFields.length === 0) {
        // SIMPAN KE DATABASE
        const newTask = await db.prisma.task.create({
          data: {
            classId: kelas.id, 
            mapel: finalMapel, 
            judul, 
            deadline: parsedDeadline, 
            isGroupTask: isGroupTask, 
            link: link || "-", 
            attachmentData: attachmentData, 
          }
        });
        
        // --- RESPON SUKSES KEREN ---
        const dateStr = newTask.deadline.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = newTask.deadline.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
        const typeIcon = newTask.isGroupTask ? "👥 Kelompok" : "👤 Individu";

        let reply = `🤖 *TUGAS BARU TERCATAT*\n`;
        reply += `──────────────────────\n`;
        reply += `📚 *${newTask.mapel}*\n`;
        reply += `📝 "${newTask.judul}"\n`;
        reply += `📅 ${dateStr} • ${timeStr} WIB\n`;
        reply += `📌 Tipe: ${typeIcon}\n`;
        
        if (newTask.link && newTask.link !== '-') {
            reply += `🔗 Link: ${newTask.link}\n`;
        }
        if (attachmentData) {
            reply += `📎 _Lampiran File Tersimpan_\n`;
        }
        
        reply += `──────────────────────\n`;
        reply += `💡 _Cek daftar: #list-task_`;
        
        return sock.sendMessage(from, { text: reply, mentions: [sender] });

      } else {
        // Fallback ke Sesi Interaktif
        const sessions = bot.sessions;
        const startStep = missingFields.includes("mapel") ? 1 : 2; 

        sessions.set(sender, {
          type: "ADD_TASK", groupId: from, classId: kelas.id,
          step: startStep, 
          data: { 
            attachmentData, 
            mapel: finalMapel || null, judul, deadline: parsedDeadline, isGroupTask, link
          }
        });

        const listMapel = kelas.semesters[0].subjects.map((s, i) => `*${i + 1}.* ${s.name}`).join("\n");
        const promptText = missingFields.includes("mapel") 
            ? `⚠️ AI kurang yakin mapelnya. Pilih nomor manual:\n\n${listMapel}` 
            : `⚠️ AI butuh detail Judul/Deadline. Ketik *JUDUL* tugas:`;

        await sock.sendMessage(from, { text: promptText });
      }

    } catch (e) {
      console.error("Error addTaskAI:", e);
      await sock.sendMessage(from, { text: `❌ Gagal proses AI. Error: ${e.message}` });
    }
  }
};