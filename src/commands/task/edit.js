const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');

module.exports = {
  name: "#edit-task",
  description: "Edit tugas. Format: #edit-task [ID] [judul/deadline/status/link/attachment/tipe] [Value]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    
    if (args.length < 3) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ Format Salah!\nContoh:\n`#edit-task 15 judul Makalah Sejarah`\n`#edit-task 15 tipe kelompok`\n`#edit-task 15 deadline 2025-12-31 15:00`" 
        });
    }

    const taskId = parseInt(args[0]);
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");

    if (isNaN(taskId)) return bot.sock.sendMessage(from, { text: "❌ ID harus angka." });

    // Validasi Field yang diperbolehkan (termasuk 'tipe' untuk isGroupTask)
    if (!["judul", "deadline", "status", "link", "attachment", "tipe"].includes(field)) {
        return bot.sock.sendMessage(from, { text: "❌ Field salah. Pilih: judul, deadline, status, link, attachment, atau tipe." });
    }

    // --- LOGIKA DOWNLOAD MEDIA BARU (SAMA SEPERTI SEBELUMNYA) ---
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    let newAttachmentData = null;

    if (field === "attachment" && newValue.toLowerCase() === "new" && quotedContext && quotedContext.quotedMessage) {
        const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage'];
        const mediaType = mediaKeys.find(key => quotedContext.quotedMessage[key]);
        
        if (mediaType) {
             try {
                const mediaMessage = quotedContext.quotedMessage[mediaType];
                const quotedMsgObject = { key: quotedContext.stanzaId, message: quotedContext.quotedMessage };
                const stream = await downloadMediaMessage(quotedMsgObject, 'buffer', {});
                const extension = mediaMessage.mimetype.split('/')[1];
                const timestamp = Date.now();
                const fileName = `${timestamp}_${mediaMessage.fileSha256?.toString('hex').substring(0, 8) || 'new_hash'}.${extension}`;
                const localFilePath = path.join(MEDIA_DIR, fileName);
                fs.writeFileSync(localFilePath, stream);
                newAttachmentData = JSON.stringify({
                    type: mediaType, mimetype: mediaMessage.mimetype, localFilePath: localFilePath 
                });
             } catch (e) { return bot.sock.sendMessage(from, { text: "❌ Gagal download file baru." }); }
        }
    }
    // --- END DOWNLOAD MEDIA BARU ---

    try {
        // Cek Task & Validasi Grup
        const task = await bot.db.prisma.task.findFirst({
            where: { id: taskId, class: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } }
        });

        if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

        let updateData = {};
        let displayValue = newValue;

        // --- LOGIC UPDATE PER FIELD ---
        
        if (field === "deadline") {
            const isoStart = newValue.replace(" ", "T") + ":00+07:00"; 
            const date = new Date(isoStart);
            if (isNaN(date.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format tanggal salah. Gunakan YYYY-MM-DD HH:mm." });
            updateData.deadline = date;
            displayValue = date.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });
        
        } else if (field === "status") {
            const lowerVal = newValue.toLowerCase();
            updateData.status = ["done", "selesai"].includes(lowerVal) ? "Selesai" : "Pending";
            displayValue = updateData.status;
        
        } else if (field === "tipe") { // FIELD BARU: isGroupTask
            const lowerVal = newValue.toLowerCase();
            if (["kelompok", "group", "grup"].includes(lowerVal)) {
                updateData.isGroupTask = true;
                displayValue = "KELOMPOK 👥";
            } else if (["individu", "personal", "sendiri"].includes(lowerVal)) {
                updateData.isGroupTask = false;
                displayValue = "INDIVIDU 👤";
            } else {
                return bot.sock.sendMessage(from, { text: "❌ Tipe salah. Pilih 'kelompok' atau 'individu'." });
            }

        } else if (field === "attachment") {
             if (newValue.toLowerCase() === "clear" || newValue === "-") {
                if (task.attachmentData) { try { const attach = JSON.parse(task.attachmentData); if(attach.localFilePath && fs.existsSync(attach.localFilePath)) fs.unlinkSync(attach.localFilePath); } catch(e){} }
                updateData.attachmentData = null; 
                displayValue = "DIHAPUS";
             } else if (newValue.toLowerCase() === "new" && newAttachmentData) {
                if (task.attachmentData) { try { const attach = JSON.parse(task.attachmentData); if(attach.localFilePath && fs.existsSync(attach.localFilePath)) fs.unlinkSync(attach.localFilePath); } catch(e){} }
                updateData.attachmentData = newAttachmentData;
                displayValue = "DIGANTI BARU";
             } else {
                 return bot.sock.sendMessage(from, { text: "⚠️ Gunakan 'clear' atau reply media dengan 'new'." });
             }
        
        } else {
            // Judul & Link
            updateData[field] = newValue;
        }

        // Eksekusi Update
        await bot.db.prisma.task.update({
            where: { id: taskId },
            data: updateData
        });

        await bot.sock.sendMessage(from, {
            text: `✏️ *TUGAS DIUPDATE*\n\n📚 Mapel: ${task.mapel}\n🔧 Bagian: ${field.toUpperCase()}\n📝 Menjadi: *${displayValue}*\n\nDiupdate oleh: @${sender.split("@")[0]}`,
            mentions: [sender]
        });

    } catch (e) {
        console.error(e);
        await bot.sock.sendMessage(from, { text: "❌ Gagal update tugas." });
    }
  }
};