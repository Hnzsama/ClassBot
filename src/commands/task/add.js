// src/commands/tugas/add.js
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Direktori tempat file tugas akan disimpan
const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

module.exports = {
  name: "#add-task",
  description: "Tambah tugas baru (Mode Interaktif). Reply media untuk melampirkan file.",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    const userNumber = sender.split("@")[0];

    // Cek Sesi Aktif
    if (bot.sessions.has(sender)) {
      return bot.sock.sendMessage(from, { 
        text: `⚠️ @${userNumber}, selesaikan input sebelumnya dulu atau ketik *batal*.`,
        mentions: [sender]
      });
    }

    // Saran Mode AI
    if (text.includes("|")) {
       return bot.sock.sendMessage(from, { text: "⚠️ Gunakan mode interaktif dengan `#add-task` saja, atau coba mode AI: `#add-task-ai`." });
    }

    // --- LOGIKA DETEKSI DAN DOWNLOAD LAMPIRAN (ROBUST CHECK) ---
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    let attachmentData = null;
    let attachmentNote = "";

    if (quotedContext && quotedContext.quotedMessage) {
      const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'];
      const mediaType = mediaKeys.find(key => quotedContext.quotedMessage[key]);
      
      if (mediaType) {
        try {
            const mediaMessage = quotedContext.quotedMessage[mediaType];
            
            // Rekonstruksi objek pesan yang di-reply (Baileys membutuhkan ini untuk download)
            const quotedMessageObject = {
                key: {
                    remoteJid: from,
                    id: quotedContext.stanzaId,
                    participant: quotedContext.participant,
                },
                message: quotedContext.quotedMessage // Proto message object
            };
            
            // 1. Download Media ke Buffer
            const stream = await downloadMediaMessage(
                quotedMessageObject, 
                'buffer',
                {}
            );

            // 2. Tentukan Path Lokal
            const extension = mediaMessage.mimetype.split('/')[1] || 'bin';
            const timestamp = Date.now();
            const fileName = `${timestamp}_${mediaMessage.fileSha256?.toString('hex').substring(0, 8) || 'no_hash'}.${extension}`;
            const localFilePath = path.join(MEDIA_DIR, fileName);

            // 3. Simpan File ke Disk
            fs.writeFileSync(localFilePath, stream);
            
            // 4. Simpan Metadata + Local Path ke Sesi
            attachmentData = JSON.stringify({
                type: mediaType,
                mimetype: mediaMessage.mimetype,
                localFilePath: localFilePath, // <-- Kunci lokal untuk Detail/Delete
                mediaKey: mediaMessage.mediaKey ? mediaMessage.mediaKey.toString('base64') : null,
                fileSha256: mediaMessage.fileSha256 ? mediaMessage.fileSha256.toString('base64') : null,
            });
            attachmentNote = "\n📎 *Lampiran Terdeteksi & Tersimpan!*";

        } catch (e) {
            console.error("Gagal mendownload atau menyimpan file:", e);
            attachmentNote = "\n❌ *GAGAL* menyimpan lampiran file ke server bot. Lanjut tanpa lampiran.";
            attachmentData = null; 
        }
      }
    }
    // --- END LOGIKA DETEKSI ---


    try {
      // 2. Ambil Data Kelas & Mapel (FIX: Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
      });

      if (!kelas || kelas.semesters.length === 0) return bot.sock.sendMessage(from, { text: "❌ Kelas/Semester belum siap. Hubungi Admin." });

      const subjects = kelas.semesters[0].subjects;
      if (subjects.length === 0) return bot.sock.sendMessage(from, { text: "❌ Belum ada mapel. Gunakan #add-mapel dulu." });

      // Format List Mapel dengan Nomor Urut
      const listMapel = subjects.map((s, i) => `*${i + 1}.* ${s.name}`).join("\n");

      // 4. Mulai Sesi (STEP 1: Mapel)
      bot.sessions.set(sender, {
        type: "ADD_TASK",
        groupId: from,
        step: 1,
        classId: kelas.id,
        data: { attachmentData: attachmentData } // Simpan data lampiran ke sesi
      });

      // 5. Kirim Pesan Pembuka
      await bot.sock.sendMessage(from, { 
        text: `🔒 *INPUT TUGAS BARU*${attachmentNote}
Halo @${userNumber}! 👋
_(Ketik *batal* jika ingin keluar dari sesi ini)_

⚠️ *INFO PENTING: Pengingat Otomatis*
Bot akan mengirim reminder H-24, H-12, H-6, dan H-1 jam sebelum deadline.

Silahkan pilih mata kuliah (Ketik nomornya saja):

${listMapel}

_Contoh: Ketik *1* untuk memilih ${subjects[0].name}_`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
    }
  }
};