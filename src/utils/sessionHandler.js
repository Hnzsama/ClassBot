const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function handleSession(bot, msg, text) {
  const { sessions, sock, db } = bot;
  const sender = msg.key.participant || msg.key.remoteJid;
  const from = msg.key.remoteJid;
  const userNumber = sender.split("@")[0];

  const session = sessions.get(sender);
  if (!session || session.groupId !== from) return;

  // === LOGIC BATAL ===
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

        if (isNaN(nomorPilihan)) {
            return await sock.sendMessage(from, { 
                text: `⚠️ @${userNumber}, mohon ketik *NOMOR* saja (Angka).\nContoh: 1\n_(Ketik 'batal' untuk keluar)_`,
                mentions: [sender]
            });
        }

        const kelas = await db.prisma.class.findUnique({
            where: { id: session.classId },
            include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
        });

        const subjects = kelas.semesters[0].subjects;
        const index = nomorPilihan - 1;

        if (index < 0 || index >= subjects.length) {
            return await sock.sendMessage(from, { 
                text: `❌ Nomor salah @${userNumber}. Pilih angka 1 sampai ${subjects.length}.`,
                mentions: [sender]
            });
        }

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
            text: `📝 Judul dicatat.\n\nLanjut @${userNumber}, ketik *DEADLINE* (Format: YYYY-MM-DD):\nContoh: *2025-12-30*`,
            mentions: [sender]
        });
      }

      // [STEP 3] DEADLINE (Simpan dulu, jangan push DB)
      if (session.step === 3) {
        const deadline = new Date(text);
        if (isNaN(deadline.getTime())) {
          return await sock.sendMessage(from, { 
              text: `❌ Format tanggal salah @${userNumber}. Gunakan YYYY-MM-DD.`,
              mentions: [sender]
          });
        }
        
        // Simpan deadline sementara di session data
        session.data.deadline = deadline;
        
        // Pindah ke Step 4 (Link)
        session.step = 4;
        
        return await sock.sendMessage(from, {
            text: `📅 Tanggal aman.\n\nTerakhir @${userNumber}, masukkan *LINK* tugas (Opsional).\n(Misal: GDrive, Classroom, atau Youtube)\n\n👉 Ketik *tanda strip (-)* jika tidak ada.`,
            mentions: [sender]
        });
      }

      // [STEP 4] LINK & SAVE KE DB
      if (session.step === 4) {
        let link = text.trim();
        
        // Cek jika user ingin skip
        if (link === "-" || link.toLowerCase() === "skip" || link.toLowerCase() === "tidak ada") {
            link = "-";
        }

        // Simpan ke Database
        await db.prisma.task.create({
          data: {
            classId: session.classId,
            mapel: session.data.mapel,
            judul: session.data.judul,
            deadline: session.data.deadline, // Ambil dari sesi step sebelumnya
            link: link // Ambil dari input step ini
          }
        });

        sessions.delete(sender);

        // Pesan Sukses Lengkap
        let reply = `✅ *TUGAS BERHASIL DITAMBAHKAN*\n\n`;
        reply += `📚 Mapel: ${session.data.mapel}\n`;
        reply += `📝 Judul: ${session.data.judul}\n`;
        reply += `📅 Deadline: ${session.data.deadline.toLocaleDateString("id-ID")}\n`;
        
        if (link !== "-") {
            reply += `🔗 Link: ${link}\n`;
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
  }
}

module.exports = { handleSession };