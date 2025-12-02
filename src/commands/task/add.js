// src/commands/tugas/add.js
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

module.exports = {
  name: "#add-task",
  description: "Tambah tugas baru (Interaktif). Reply media untuk lampiran.",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    const userNumber = sender.split("@")[0];

    // Cek Sesi Aktif
    if (bot.sessions.has(sender)) {
      return bot.sock.sendMessage(from, { 
        text: `⏳ @${userNumber}, kamu masih punya sesi input yang belum selesai.\nSelesaikan dulu atau ketik *batal*.`,
        mentions: [sender]
      });
    }

    if (text.includes("|")) {
       return bot.sock.sendMessage(from, { text: "💡 Gunakan `#add-task` saja untuk mode tanya-jawab. Jangan pakai tanda pipa (|)." });
    }

    // --- LOGIKA DOWNLOAD LAMPIRAN ---
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    let attachmentData = null;
    let attachmentNote = "";

    if (quotedContext && quotedContext.quotedMessage) {
      const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'];
      const mediaType = mediaKeys.find(key => quotedContext.quotedMessage[key]);
      
      if (mediaType) {
        try {
            const mediaMessage = quotedContext.quotedMessage[mediaType];
            const quotedMessageObject = {
                key: { remoteJid: from, id: quotedContext.stanzaId, participant: quotedContext.participant },
                message: quotedContext.quotedMessage 
            };
            
            const stream = await downloadMediaMessage(quotedMessageObject, 'buffer', {});
            const extension = mediaMessage.mimetype.split('/')[1] || 'bin';
            const fileName = `${Date.now()}_${mediaMessage.fileSha256?.toString('hex').substring(0, 8) || 'file'}.${extension}`;
            const localFilePath = path.join(MEDIA_DIR, fileName);

            fs.writeFileSync(localFilePath, stream);
            
            attachmentData = JSON.stringify({
                type: mediaType,
                mimetype: mediaMessage.mimetype,
                localFilePath: localFilePath
            });
            attachmentNote = "\n📎 *Lampiran File Tersimpan!*";

        } catch (e) {
            console.error("Gagal download lampiran:", e);
            attachmentNote = "\n⚠️ *Gagal menyimpan lampiran*. Lanjut tanpa file.";
        }
      }
    }

    try {
      // 1. Ambil Data Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
      });

      if (!kelas || kelas.semesters.length === 0) return bot.sock.sendMessage(from, { text: "❌ Kelas belum siap. Pastikan semester aktif sudah diset." });

      const subjects = kelas.semesters[0].subjects;
      if (subjects.length === 0) return bot.sock.sendMessage(from, { text: "📂 Belum ada mata kuliah. Tambahkan dulu pakai `#add-mapel`." });

      // Format List Mapel
      const listMapel = subjects.map((s, i) => `${i + 1}. ${s.name}`).join("\n");

      // 2. Mulai Sesi
      bot.sessions.set(sender, {
        type: "ADD_TASK",
        groupId: from,
        step: 1,
        classId: kelas.id,
        data: { attachmentData: attachmentData } 
      });

      // 3. Pesan Pembuka Interaktif
      await bot.sock.sendMessage(from, { 
        text: `📝 *INPUT TUGAS BARU*${attachmentNote}
─────────────────────
Halo @${userNumber}! Mari kita catat tugas baru.
_(Ketik *batal* kapan saja untuk berhenti)_

*Langkah 1/5: Pilih Mata Kuliah*
Silakan balas dengan *NOMOR* mapel di bawah ini:

${listMapel}

_Contoh: Ketik *1* untuk memilih ${subjects[0].name}_`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
    }
  }
};