// src/commands/tugas/detail.js
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "#detail-task",
  description: "Lihat detail tugas lengkap + lampiran. Format: #detail-task [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    const taskId = parseInt(args[0]);
    if (isNaN(taskId)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID tugas (Angka)." });

    try {
      // 1. Cari Kelas (FIX: Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Ambil Tugas
      const task = await bot.db.prisma.task.findFirst({
        where: { id: taskId, classId: kelas.id }
      });

      if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

      // 3. Format Detail Pesan
      const statusIcon = task.status === 'Selesai' ? '✅' : task.status === 'Terlewat' ? '❌' : '⏳';
      const typeIcon = task.isGroupTask ? '👥' : '👤';
      const deadlineStr = task.deadline.toLocaleString("id-ID", { dateStyle: 'full', timeStyle: 'short' });
      const createdDate = task.createdAt.toLocaleString("id-ID", { dateStyle: 'short', timeStyle: 'short' });

      let detailText = `📋 *DETAIL TUGAS #${task.id}*\n`;
      detailText += `───────────────────\n`;
      detailText += `📚 Mapel: *${task.mapel}*\n`;
      detailText += `📝 Judul: ${task.judul}\n`;
      detailText += `📌 Tipe: ${typeIcon} ${task.isGroupTask ? 'Kelompok' : 'Individu'}\n`;
      detailText += `📅 Deadline: ${deadlineStr}\n`;
      detailText += `🔗 Link: ${task.link || '-'}\n`;
      detailText += `Status: *${statusIcon} ${task.status}*\n`;
      detailText += `Dibuat: ${createdDate}\n`;
      
      // 4. Kirim Media (Jika Ada)
      if (task.attachmentData) {
        const attach = JSON.parse(task.attachmentData);
        const localFilePath = attach.localFilePath;

        if (localFilePath && fs.existsSync(localFilePath)) {
            let messageType = attach.type.replace('Message', '');
            let mediaContent = {
                caption: `📎 Lampiran Tugas #${task.id}: ${task.judul}`
            };
            
            // Fix Stream for Baileys
            mediaContent[messageType] = {
                stream: fs.createReadStream(localFilePath), 
                mimetype: attach.mimetype,
            };
            
            if (messageType === 'document') {
                mediaContent.document.fileName = path.basename(localFilePath);
            }

            // Kirim Media Dulu
            await bot.sock.sendMessage(from, mediaContent, { quoted: msg });
            
            // Kirim Teks Detail
            await bot.sock.sendMessage(from, { text: detailText });

        } else {
            detailText += `\n\n❌ *GAGAL LOAD LAMPIRAN*:\nFile lampiran tidak ditemukan di server bot.`;
            await bot.sock.sendMessage(from, { text: detailText });
        }
      } else {
        detailText += "\n\n☑️ (Tidak ada lampiran file)";
        await bot.sock.sendMessage(from, { text: detailText });
      }

    } catch (e) {
      console.error("Error detail-task:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil detail tugas." });
    }
  }
};