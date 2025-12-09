// src/commands/tugas/selesai.js
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const { validateTaskEvidence } = require("../../utils/aiValidator"); // Sesuaikan path

module.exports = {
  name: "#selesai",
  description: "Setor tugas dengan bukti gambar. Format: Reply Gambar + #selesai [Mapel] [Judul]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Cek Input User
    const userCaption = text.replace("#selesai", "").trim();
    if (userCaption.length < 3) {
      return bot.sock.sendMessage(from, { text: "⚠️ Mohon sertakan Nama Mapel dan Judul Tugas.\nContoh: `#selesai UAS Alpro`" }, { quoted: msg });
    }

    // 2. Cek Gambar (Harus ada)
    const isImage = msg.message?.imageMessage;
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!isImage && !isQuotedImage) {
      return bot.sock.sendMessage(from, { text: "❌ Sertakan bukti gambar! Kirim gambar dengan caption, atau reply gambar." }, { quoted: msg });
    }

    // --- PROSES DIMULAI (REAKSI JAM PASIR) ---
    await bot.sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

    try {
      // 3. Ambil ID Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 4. Ambil Semua Tugas Pending di Kelas Ini
      const pendingTasks = await bot.db.prisma.task.findMany({
        where: { classId: kelas.id, status: "Pending" }
      });

      if (pendingTasks.length === 0) {
        await bot.sock.sendMessage(from, { react: { text: "🤷‍♂️", key: msg.key } });
        return bot.sock.sendMessage(from, { text: "🎉 Tidak ada tugas pending di kelas ini." });
      }

      // 5. Download Gambar
      let buffer;
      if (isImage) {
        buffer = await downloadMediaMessage({ key: msg.key, message: msg.message }, 'buffer', {});
      } else {
        const quotedMsg = msg.message.extendedTextMessage.contextInfo;
        buffer = await downloadMediaMessage({ key: { id: quotedMsg.stanzaId }, message: quotedMsg.quotedMessage }, 'buffer', {});
      }

      // 6. KIRIM KE AI (Matching & Validasi sekaligus)
      const result = await validateTaskEvidence(bot.model, buffer, userCaption, pendingTasks);

      // --- ANALISIS HASIL AI ---
      
      // Kasus A: Tugas tidak ditemukan / Ambigu
      if (!result.taskId) {
        await bot.sock.sendMessage(from, { react: { text: "❓", key: msg.key } });
        return bot.sock.sendMessage(from, { 
            text: `⚠️ **Tugas Tidak Teridentifikasi**\n\nAnalisis AI: _"${result.reason}"_\n\nMohon tulis nama Mapel dan Judul lebih spesifik.`,
            mentions: [sender]
        }, { quoted: msg });
      }

      // Kasus B: Tugas ketemu, tapi Gambar Tidak Valid
      if (!result.isValid) {
        await bot.sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
        return bot.sock.sendMessage(from, { 
            text: `❌ **Bukti Ditolak**\n\nAnalisis AI: _"${result.reason}"_\n\nKirim ulang dengan bukti yang benar.`,
            mentions: [sender]
        }, { quoted: msg });
      }

      // Kasus C: Valid! Simpan ke Database.
      const targetTask = pendingTasks.find(t => t.id === result.taskId);
      
      // Cek apakah user sudah pernah submit
      const currentFinished = targetTask.finishedMemberIds ? targetTask.finishedMemberIds.split(",") : [];
      
      // Ambil nomor sender saja (tanpa @s.whatsapp.net) agar hemat karakter DB
      const senderNum = sender.split("@")[0]; 

      if (currentFinished.includes(senderNum)) {
         await bot.sock.sendMessage(from, { react: { text: "👌", key: msg.key } });
         return bot.sock.sendMessage(from, { text: `⚠️ Kamu sudah tercatat menyelesaikan tugas *${targetTask.judul}*.` }, { quoted: msg });
      }

      // Tambahkan user ke list
      currentFinished.push(senderNum);
      
      await bot.db.prisma.task.update({
          where: { id: targetTask.id },
          data: { finishedMemberIds: currentFinished.join(",") }
      });

      // --- SUKSES ---
      await bot.sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
      await bot.sock.sendMessage(from, {
          text: `✅ *LAPORAN DITERIMA*\n\n📚 Mapel: ${targetTask.mapel}\n📝 Judul: ${targetTask.judul}\n🤖 Status: *Valid*\n\n_"${result.reason}"_`,
          mentions: [sender]
      }, { quoted: msg });

    } catch (e) {
      console.error("Error command selesai:", e);
      await bot.sock.sendMessage(from, { react: { text: "❌", key: msg.key } });
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem." });
    }
  }
};                      