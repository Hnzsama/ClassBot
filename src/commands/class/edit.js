const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Direktori tempat file tugas disimpan
const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');

module.exports = {
  name: "#edit-task",
  description: "Edit tugas. Format: #edit-task [ID] [judul/deadline/status/link/attachment/tipe] [Value]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    
    // 1. Validasi Input
    if (args.length < 3) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ Format Salah!\nContoh:\n`#edit-task 15 judul Makalah Sejarah`\n`#edit-task 15 tipe kelompok`\n`#edit-task 15 deadline 2025-12-31 15:00`\n`#edit-task 15 attachment clear`" 
        });
    }

    const taskId = parseInt(args[0]);
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");

    if (isNaN(taskId)) return bot.sock.sendMessage(from, { text: "❌ ID harus berupa angka." });

    // Validasi Field yang diperbolehkan (termasuk 'tipe' untuk isGroupTask)
    if (!["judul", "deadline", "status", "link", "attachment", "tipe"].includes(field)) {
        return bot.sock.sendMessage(from, { text: "❌ Field salah. Pilih: judul, deadline, status, link, attachment, atau tipe." });
    }

    // --- 2. LOGIKA DOWNLOAD MEDIA BARU (JIKA ADA) ---
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    let newAttachmentData = null;

    // Hanya jalankan jika field attachment dan user minta 'new' sambil reply pesan
    if (field === "attachment" && newValue.toLowerCase() === "new" && quotedContext && quotedContext.quotedMessage) {
        const mediaKeys = ['imageMessage', 'videoMessage', 'documentMessage'];
        const mediaType = mediaKeys.find(key => quotedContext.quotedMessage[key]);
        
        if (mediaType) {
             try {
                const mediaMessage = quotedContext.quotedMessage[mediaType];
                
                // Objek pesan untuk downloadMediaMessage
                const quotedMsgObject = { 
                    key: { 
                        remoteJid: from, 
                        id: quotedContext.stanzaId, 
                        participant: quotedContext.participant 
                    }, 
                    message: quotedContext.quotedMessage 
                };

                const stream = await downloadMediaMessage(quotedMsgObject, 'buffer', {});
                
                const extension = mediaMessage.mimetype.split('/')[1] || 'bin';
                const timestamp = Date.now();
                const fileName = `${timestamp}_${mediaMessage.fileSha256?.toString('hex').substring(0, 8) || 'edit'}.${extension}`;
                const localFilePath = path.join(MEDIA_DIR, fileName);
                
                // Simpan file baru ke disk
                fs.writeFileSync(localFilePath, stream);
                
                // Siapkan metadata baru
                newAttachmentData = JSON.stringify({
                    type: mediaType, 
                    mimetype: mediaMessage.mimetype, 
                    localFilePath: localFilePath 
                });

             } catch (e) { 
                 console.error("Gagal download file edit:", e);
                 return bot.sock.sendMessage(from, { text: "❌ Gagal download file baru. Pastikan file belum kadaluarsa." }); 
             }
        } else {
            return bot.sock.sendMessage(from, { text: "⚠️ Pesan yang di-reply tidak mengandung media yang didukung." });
        }
    }
    // --- END DOWNLOAD MEDIA ---

    try {
        // 3. Cek Task & Validasi Grup (Dual Group Check)
        const task = await bot.db.prisma.task.findFirst({
            where: { 
                id: taskId, 
                class: { 
                    OR: [
                        { mainGroupId: from }, 
                        { inputGroupId: from }
                    ] 
                } 
            }
        });

        if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

        // 4. Logic Update Berdasarkan Field
        let updateData = {};
        let displayValue = newValue;

        if (field === "deadline") {
            // Parsing Tanggal dengan WIB forced
            const isoStart = newValue.replace(" ", "T") + ":00+07:00"; 
            const date = new Date(isoStart);
            
            if (isNaN(date.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format tanggal salah. Gunakan YYYY-MM-DD HH:mm." });
            
            updateData.deadline = date;
            displayValue = date.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });
        
        } else if (field === "status") {
            const lowerVal = newValue.toLowerCase();
            if (["done", "selesai", "sudah"].includes(lowerVal)) {
                updateData.status = "Selesai";
            } else if (["pending", "belum", "terlewat"].includes(lowerVal)) { 
                updateData.status = "Pending";
            } else {
                return bot.sock.sendMessage(from, { text: "❌ Status hanya: 'Pending' atau 'Selesai'." });
            }
            displayValue = updateData.status;
        
        } else if (field === "tipe") { // LOGIC BARU: isGroupTask
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
             // Opsi 1: Hapus Lampiran
             if (newValue.toLowerCase() === "clear" || newValue === "-") {
                if (task.attachmentData) { 
                    try { 
                        const attach = JSON.parse(task.attachmentData); 
                        if(attach.localFilePath && fs.existsSync(attach.localFilePath)) {
                            fs.unlinkSync(attach.localFilePath); // Hapus Fisik Lama
                        }
                    } catch(e){ console.error("Gagal hapus file lama:", e); } 
                }
                updateData.attachmentData = null; 
                displayValue = "DIHAPUS";
             
             // Opsi 2: Ganti Lampiran (Memerlukan logic download di atas sukses)
             } else if (newValue.toLowerCase() === "new" && newAttachmentData) {
                if (task.attachmentData) { 
                    try { 
                        const attach = JSON.parse(task.attachmentData); 
                        if(attach.localFilePath && fs.existsSync(attach.localFilePath)) {
                            fs.unlinkSync(attach.localFilePath); // Hapus Fisik Lama
                        }
                    } catch(e){ console.error("Gagal hapus file lama:", e); } 
                }
                updateData.attachmentData = newAttachmentData;
                displayValue = "DIGANTI BARU";
             
             } else {
                 return bot.sock.sendMessage(from, { text: "⚠️ Pilihan salah. Gunakan 'clear' atau reply media dengan mengetik 'new'." });
             }
        
        } else {
            // Default String Update (Judul & Link)
            updateData[field] = newValue;
        }

        // 5. Eksekusi Update Database
        await bot.db.prisma.task.update({
            where: { id: taskId },
            data: updateData
        });

        // 6. Kirim Konfirmasi
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