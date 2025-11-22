const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Utility untuk parsing waktu WIB
const parseWIB = (timeStr) => {
    const isoStart = timeStr.replace(" ", "T") + ":00+07:00"; 
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

async function handleSession(bot, msg, text) {
  const { sessions, sock, db } = bot;
  const sender = msg.key.participant || msg.key.remoteJid;
  const from = msg.key.remoteJid;
  const userNumber = sender.split("@")[0];

  const session = sessions.get(sender);
  if (!session || session.groupId !== from) return;

  // Safety Check Socket
  if (!sock || typeof sock.sendMessage !== 'function') {
      sessions.delete(sender); 
      return; 
  }
  
  // Logic Batal
  if (text.toLowerCase() === "batal") {
    sessions.delete(sender);
    return await sock.sendMessage(from, { 
        text: `❌ Input dibatalkan. Sesi ditutup, @${userNumber}.`,
        mentions: [sender]
    });
  }

  try {
    if (session.type === "ADD_TASK") {
      
      // [STEP 1] PILIH MAPEL
      if (session.step === 1) {
        const nomorPilihan = parseInt(text);

        if (isNaN(nomorPilihan)) { return await sock.sendMessage(from, { text: `⚠️ @${userNumber}, mohon ketik *NOMOR* saja (Angka).`, mentions: [sender] }); }

        const kelas = await db.prisma.class.findUnique({
            where: { id: session.classId },
            include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
        });

        const subjects = kelas.semesters[0].subjects;
        const index = nomorPilihan - 1;

        if (index < 0 || index >= subjects.length) { return await sock.sendMessage(from, { text: `❌ Nomor salah @${userNumber}. Pilih angka 1 sampai ${subjects.length}.`, mentions: [sender] }); }

        const targetMapel = subjects[index];
        session.data.mapel = targetMapel.name;
        
        session.step = 2;
        return await sock.sendMessage(from, { 
            text: `✅ Sip @${userNumber}, mapel *${targetMapel.name}* terpilih.\n\nSekarang masukkan *JUDUL TUGAS*:`, 
            mentions: [sender]
        });
      }

      // [STEP 2] JUDUL
      if (session.step === 2) {
        session.data.judul = text;
        session.step = 3;
        return await sock.sendMessage(from, { 
            text: `📝 Judul dicatat.\n\nLanjut @${userNumber}, ketik *DEADLINE* (Format: YYYY-MM-DD HH:mm):\nContoh: *2025-12-30 18:00*`,
            mentions: [sender]
        });
      }

      // [STEP 3] DEADLINE (TERMASUK JAM)
      if (session.step === 3) {
        const deadline = parseWIB(text);
        
        if (!deadline) {
          return await sock.sendMessage(from, { text: `❌ Format tanggal dan jam salah @${userNumber}. Gunakan YYYY-MM-DD HH:mm.`, mentions: [sender] });
        }
        
        session.data.deadline = deadline;
        session.step = 4;
        
        // PROMPT BARU: Sertakan Pilihan Angka
        return await sock.sendMessage(from, {
            text: `📅 Tanggal & Jam aman.\n\nSelanjutnya @${userNumber}, apakah ini tugas *KELOMPOK* atau *INDIVIDU*?\n\nKetik: *1* (KELOMPOK) atau *2* (INDIVIDU).`,
            mentions: [sender]
        });
      }

      // [STEP 4] TUGAS INDIVIDU / KELOMPOK
      if (session.step === 4) {
          const input = text.toLowerCase();
          let isGroupTask = null;

          // Cek Angka (1/2) atau Kata (kelompok/individu)
          if (input === '1' || input === 'kelompok' || input === 'grup') {
              isGroupTask = true; // KELOMPOK
          } else if (input === '2' || input === 'individu' || input === 'personal') {
              isGroupTask = false; // INDIVIDU
          } else {
              return await sock.sendMessage(from, { text: `⚠️ Pilihan salah. Ketik *1* (KELOMPOK) atau *2* (INDIVIDU).` });
          }
          
          session.data.isGroupTask = isGroupTask;
          session.step = 5;

          return await sock.sendMessage(from, {
              text: `✅ Tipe tugas: *${isGroupTask ? 'KELOMPOK' : 'INDIVIDU'}*\n\nTerakhir @${userNumber}, masukkan *LINK* tugas (Opsional).\n👉 Ketik *strip (-)* jika tidak ada.`,
              mentions: [sender]
          });
      }

      // [STEP 5] LINK & SAVE KE DB
      if (session.step === 5) {
        let link = text.trim();
        
        if (link === "-" || link.toLowerCase() === "skip" || link.toLowerCase() === "tidak ada") {
            link = "-";
        }

        // Simpan ke Database
        await db.prisma.task.create({
          data: {
            classId: session.classId,
            mapel: session.data.mapel,
            judul: session.data.judul,
            deadline: session.data.deadline,
            isGroupTask: session.data.isGroupTask, 
            link: link,
            attachmentData: session.data.attachmentData || null // <--- DATA LAMPIRAN DISIMPAN DISINI
          }
        });

        sessions.delete(sender);

        // Pesan Sukses Lengkap (Tampilkan Jam dan Status Tugas)
        let reply = `✅ *TUGAS BERHASIL DITAMBAHKAN*\n\n`;
        reply += `📚 Mapel: ${session.data.mapel}\n`;
        reply += `📝 Judul: ${session.data.judul}\n`;
        reply += `📌 Tipe: ${session.data.isGroupTask ? 'KELOMPOK' : 'INDIVIDU'}\n`;
        reply += `📅 Deadline: ${session.data.deadline.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' })}\n`;
        
        if (link !== "-") {
            reply += `🔗 Link: ${link}\n`;
        }
        if (session.data.attachmentData) {
            reply += `📎 _Lampiran file tugas berhasil dicatat._\n`; // Konfirmasi lampiran
        }
        
        reply += `\nOleh: @${userNumber}`;

        return await sock.sendMessage(from, {
            text: reply,
            mentions: [sender]
        });
      }
    }
  } catch (error) {
    console.error("Session Error:", error);
    sessions.delete(sender);
    await sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem. Sesi direset." });
  }
}

module.exports = { handleSession };