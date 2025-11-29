// src/commands/tugas/detail.js
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "#detail-task",
  description: "Lihat detail tugas lengkap. Format: #detail-task [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    const taskId = parseInt(args[0]);
    if (isNaN(taskId)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID tugas (Angka).\nContoh: `#detail-task 15`" });

    try {
      // 1. Cari Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Ambil Tugas
      const task = await bot.db.prisma.task.findFirst({
        where: { id: taskId, classId: kelas.id }
      });

      if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

      // 3. Hitung Sisa Waktu
      const now = new Date();
      const deadline = new Date(task.deadline);
      const diffMs = deadline - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      let timeLeft = "";
      if (task.status === 'Selesai') timeLeft = "Sudah Selesai";
      else if (diffMs < 0) timeLeft = "Waktu Habis";
      else timeLeft = diffDays === 0 ? "Hari ini!" : `${diffDays} hari lagi`;

      // 4. Format Detail Pesan
      const statusIcon = task.status === 'Selesai' ? '✅' : (diffMs < 0 ? '⛔' : '⏳');
      const typeLabel = task.isGroupTask ? '👥 KELOMPOK' : '👤 INDIVIDU';
      
      const deadlineStr = deadline.toLocaleString("id-ID", { 
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', 
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' 
      });
      
      const createdDate = task.createdAt.toLocaleDateString("id-ID");

      let detailText = `📋 *LEMBAR DETAIL TUGAS*\n`;
      detailText += `🆔 ID Tugas: \`${task.id}\`\n`;
      detailText += `──────────────────────\n`;
      detailText += `📚 *${task.mapel.toUpperCase()}*\n`;
      detailText += `📝 _${task.judul}_\n\n`;
      
      detailText += `📌 *Info:* \n`;
      detailText += `• Tipe: ${typeLabel}\n`;
      detailText += `• Status: ${statusIcon} ${task.status.toUpperCase()}\n`;
      detailText += `• Deadline: ${deadlineStr}\n`;
      detailText += `• Sisa Waktu: *${timeLeft}*\n`;
      
      if (task.link && task.link !== '-' && task.link.length > 1) {
          detailText += `\n🔗 *Link Sumber:*\n${task.link}\n`;
      }

      detailText += `──────────────────────\n`;
      detailText += `📅 Dibuat: ${createdDate}`;

      // 5. Kirim Media (Jika Ada)
      if (task.attachmentData) {
        const attach = JSON.parse(task.attachmentData);
        const localFilePath = attach.localFilePath;

        if (localFilePath && fs.existsSync(localFilePath)) {
            let messageType = attach.type.replace('Message', '');
            
            // Siapkan objek media
            let mediaContent = {
                caption: `📎 *LAMPIRAN TUGAS #${task.id}*\n${task.judul}`
            };
            
            // Stream media
            mediaContent[messageType] = {
                stream: fs.createReadStream(localFilePath), 
                mimetype: attach.mimetype,
            };
            
            if (messageType === 'document') {
                mediaContent.document.fileName = path.basename(localFilePath);
            }

            // Kirim Media Dulu
            await bot.sock.sendMessage(from, mediaContent, { quoted: msg });
            // Lalu Kirim Teks Detail
            await bot.sock.sendMessage(from, { text: detailText });

        } else {
            detailText += `\n⚠️ *Lampiran Hilang*: File fisik tidak ditemukan di server.`;
            await bot.sock.sendMessage(from, { text: detailText });
        }
      } else {
        await bot.sock.sendMessage(from, { text: detailText });
      }

    } catch (e) {
      console.error("Error detail-task:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil detail tugas." });
    }
  }
};