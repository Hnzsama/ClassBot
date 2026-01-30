// src/commands/tugas/addTaskAI.js

const AIHandler = require('../../utils/aiHandler');
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
  name: "#task-add-ai",
  description: "Add task via AI. Reply image for OCR or attachment (--lampiran).",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;
    const userNumber = sender.split("@")[0];

    const ai = new AIHandler(bot);

    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif." });
    if (!from.endsWith("@g.us")) return;

    let inputData = text.replace("#task+ai", "").trim();

    // --- DETEKSI MODE LAMPIRAN ---
    const isAttachmentMode = inputData.includes("--lampiran") || inputData.includes("--attach");
    inputData = inputData.replace("--lampiran", "").replace("--attach", "").trim();

    let attachmentData = null;

    // 1. Deteksi Media via AIHandler
    const media = await ai.downloadMedia(msg, from);

    if (media && isAttachmentMode) {
      try {
        const mediaMessage = media.mediaMessage;
        const extension = media.mimeType.split('/')[1] || 'bin';
        // fileSha256 is Buffer in Baileys
        const sha = mediaMessage.fileSha256 ? mediaMessage.fileSha256.toString('hex').substring(0, 8) : Date.now();
        const fName = `${Date.now()}_ai_${sha}.${extension}`;
        const localFilePath = path.join(MEDIA_DIR, fName);

        fs.writeFileSync(localFilePath, media.buffer);

        attachmentData = JSON.stringify({
          type: media.type + 'Message', // e.g. imageMessage
          mimetype: media.mimeType,
          localFilePath: localFilePath,
          mediaKey: mediaMessage.mediaKey?.toString('base64'),
          fileSha256: mediaMessage.fileSha256?.toString('base64'),
        });
      } catch (e) {
        console.error("Attachment Error:", e);
        return sock.sendMessage(from, { text: "❌ Gagal menyimpan lampiran." });
      }
    }

    if (inputData.length < 5 && !media) {
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

      const result = await ai.generateJSON(systemPrompt, inputData, media);

      if (!result.success) {
        return sock.sendMessage(from, { text: "❌ AI bingung membaca respon." });
      }

      const taskData = result.data;

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
        reply += `💡 _Cek daftar: #task-list_`;

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