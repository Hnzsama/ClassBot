// src/commands/tugas/edit.js
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

module.exports = {
  name: "#edit-task",
  description: "Edit tugas. Format: #edit-task [ID] [Field] [Value]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    
    // VALIDASI 1: Jumlah Argumen
    if (args.length < 3) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ *Format Salah (Gunakan Spasi)*\n\nContoh:\n`#edit-task 15 judul Makalah Sejarah`\n`#edit-task 15 deadline 2025-12-31 23:59`"
        });
    }

    // PARSING INPUT (SPASI)
    const taskId = parseInt(args[0]);
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ").trim(); 

    if (isNaN(taskId)) return bot.sock.sendMessage(from, { text: "❌ ID harus berupa angka." });

    const allowedFields = ["judul", "deadline", "status", "link", "attachment", "tipe"];
    if (!allowedFields.includes(field)) {
        return bot.sock.sendMessage(from, { text: `❌ Field salah. Pilih: ${allowedFields.join(", ")}` });
    }

    // --- LOGIC DOWNLOAD MEDIA ---
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    let newAttachmentData = null;

    if (field === "attachment" && newValue.toLowerCase() === "new" && quotedContext && quotedContext.quotedMessage) {
        const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage'];
        const mediaType = mediaKeys.find(key => quotedContext.quotedMessage[key]);
        
        if (mediaType) {
             try {
                const mediaMessage = quotedContext.quotedMessage[mediaType];
                const quotedMsgObject = { 
                    key: { remoteJid: from, id: quotedContext.stanzaId, participant: quotedContext.participant }, 
                    message: quotedContext.quotedMessage 
                };
                const stream = await downloadMediaMessage(quotedMsgObject, 'buffer', {});
                const extension = mediaMessage.mimetype.split('/')[1] || 'bin';
                const fileName = `${Date.now()}_${mediaMessage.fileSha256?.toString('hex').substring(0, 8) || 'edit'}.${extension}`;
                const localFilePath = path.join(MEDIA_DIR, fileName);
                fs.writeFileSync(localFilePath, stream);
                
                newAttachmentData = JSON.stringify({ type: mediaType, mimetype: mediaMessage.mimetype, localFilePath: localFilePath });
             } catch (e) { return bot.sock.sendMessage(from, { text: "❌ Gagal download file baru." }); }
        } else { return bot.sock.sendMessage(from, { text: "⚠️ Reply pesan media." }); }
    }
    // -----------------------------------------

    try {
        // Cek Tugas & Kelas
        const task = await bot.db.prisma.task.findFirst({
            where: { id: taskId, class: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } }
        });

        if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

        let updateData = {};
        let displayValue = newValue;

        // === MODIFIKASI DIMULAI DARI SINI ===
        if (field === "deadline") {
            // Auto replace spasi dengan T untuk format ISO, tambah WIB
            const isoStart = newValue.replace(" ", "T") + ":00+07:00"; 
            const date = new Date(isoStart);
            
            if (isNaN(date.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format tanggal salah. Gunakan: YYYY-MM-DD HH:mm" });
            
            updateData.deadline = date;
            displayValue = date.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });

            // 1. Reset Reminder Status agar Cronjob menganggap ini jadwal baru
            await bot.db.prisma.taskReminderStatus.deleteMany({
                where: { taskId: taskId }
            });
            
            // 2. Info tambahan untuk user
            displayValue += " (🔔 Reminder Direset)";
        
        // === BATAS AKHIR MODIFIKASI ===
        
        } else if (field === "status") {
            const lowerVal = newValue.toLowerCase();
            if (["done", "selesai", "sudah"].includes(lowerVal)) {
                updateData.status = "Selesai";
            } else if (["pending", "belum"].includes(lowerVal)) { 
                updateData.status = "Pending";
            } else {
                return bot.sock.sendMessage(from, { text: "❌ Status hanya: 'Pending' atau 'Selesai'." });
            }
            displayValue = updateData.status;
        
        } else if (field === "tipe") {
            const lowerVal = newValue.toLowerCase();
            if (["kelompok", "group"].includes(lowerVal)) {
                updateData.isGroupTask = true;
                displayValue = "KELOMPOK 👥";
            } else if (["individu", "sendiri"].includes(lowerVal)) {
                updateData.isGroupTask = false;
                displayValue = "INDIVIDU 👤";
            } else {
                return bot.sock.sendMessage(from, { text: "❌ Tipe salah. Pilih 'kelompok' atau 'individu'." });
            }

        } else if (field === "attachment") {
             if (newValue.toLowerCase() === "clear" || newValue === "-") {
                if (task.attachmentData) { 
                    try { 
                        const attach = JSON.parse(task.attachmentData); 
                        if(attach.localFilePath && fs.existsSync(attach.localFilePath)) fs.unlinkSync(attach.localFilePath);
                    } catch(e){} 
                }
                updateData.attachmentData = null; 
                displayValue = "DIHAPUS 🗑️";
             } else if (newValue.toLowerCase() === "new" && newAttachmentData) {
                if (task.attachmentData) { 
                    try { 
                        const attach = JSON.parse(task.attachmentData); 
                        if(attach.localFilePath && fs.existsSync(attach.localFilePath)) fs.unlinkSync(attach.localFilePath);
                    } catch(e){} 
                }
                updateData.attachmentData = newAttachmentData;
                displayValue = "DIGANTI BARU 📎";
             } else {
                 return bot.sock.sendMessage(from, { text: "⚠️ Gunakan 'clear' untuk hapus, atau reply media + ketik 'new'." });
             }
        } else {
            // Judul / Link
            updateData[field] = newValue;
        }

        await bot.db.prisma.task.update({ where: { id: taskId }, data: updateData });

        await bot.sock.sendMessage(from, {
            text: `✅ *UPDATE BERHASIL*\n\n📚 Mapel: ${task.mapel}\n🔧 Bagian: *${field.toUpperCase()}*\n📝 Menjadi: ${displayValue}\n\nOleh: @${sender.split("@")[0]}`,
            mentions: [sender]
        });

    } catch (e) {
        console.error(e);
        await bot.sock.sendMessage(from, { text: "❌ Gagal update tugas." });
    }
  }
};