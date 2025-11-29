// src/handlers/session.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// UTILITY: Parsing Waktu Cerdas
const parseSmartDate = (input) => {
    // Cek format lengkap: YYYY-MM-DD HH:mm
    if (input.includes(" ")) {
        const isoStart = input.replace(" ", "T") + ":00+07:00";
        const date = new Date(isoStart);
        return isNaN(date.getTime()) ? null : date;
    } 
    // Cek format tanggal saja: YYYY-MM-DD -> Otomatis jam 23:59
    else {
        const isoStart = input + "T23:59:00+07:00";
        const date = new Date(isoStart);
        return isNaN(date.getTime()) ? null : date;
    }
}

async function handleSession(bot, msg, text) {
  const { sessions, sock, db } = bot;
  const sender = msg.key.participant || msg.key.remoteJid;
  const from = msg.key.remoteJid;
  const userNumber = sender.split("@")[0];

  const session = sessions.get(sender);
  if (!session || session.groupId !== from) return;

  if (!sock || typeof sock.sendMessage !== 'function') { sessions.delete(sender); return; }
  
  if (text.toLowerCase() === "batal") {
    sessions.delete(sender);
    return await sock.sendMessage(from, { 
        text: `⛔ Input dibatalkan. Data dihapus.`, mentions: [sender] 
    });
  }

  try {
    if (session.type === "ADD_TASK") {
      
      // [STEP 1] PILIH MAPEL
      if (session.step === 1) {
        const nomorPilihan = parseInt(text);

        if (isNaN(nomorPilihan)) { 
            return await sock.sendMessage(from, { text: `⚠️ Mohon ketik *ANGKA* sesuai nomor mapel di list.`, mentions: [sender] }); 
        }

        const kelas = await db.prisma.class.findUnique({
            where: { id: session.classId },
            include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } }
        });

        const subjects = kelas.semesters[0].subjects;
        const index = nomorPilihan - 1;

        if (index < 0 || index >= subjects.length) { 
            return await sock.sendMessage(from, { text: `❌ Nomor tidak ada. Pilih antara 1 - ${subjects.length}.`, mentions: [sender] }); 
        }

        const targetMapel = subjects[index];
        session.data.mapel = targetMapel.name;
        
        session.step = 2;
        return await sock.sendMessage(from, { 
            text: `✅ Oke, Mapel: *${targetMapel.name}*\n\n*Langkah 2/5: Judul Tugas*\nSilakan ketik judul atau topik tugasnya.\n_(Singkat & Jelas, misal: Makalah Sejarah)_`, 
            mentions: [sender]
        });
      }

      // [STEP 2] JUDUL
      if (session.step === 2) {
        session.data.judul = text;
        session.step = 3;
        
        // Instruksi Deadline yang lebih jelas
        return await sock.sendMessage(from, { 
            text: `📝 Judul dicatat: "${text}"\n\n*Langkah 3/5: Deadline*\nKapan tugas ini dikumpulkan?\n\n🔹 *Opsi 1 (Lengkap):* YYYY-MM-DD HH:mm\nContoh: \`2025-11-25 15:00\`\n\n🔹 *Opsi 2 (Tanggal Saja):* YYYY-MM-DD\nContoh: \`2025-11-25\` (Otomatis jam 23:59)`,
            mentions: [sender]
        });
      }

      // [STEP 3] DEADLINE (SMART PARSING)
      if (session.step === 3) {
        const deadline = parseSmartDate(text);
        
        if (!deadline) {
          return await sock.sendMessage(from, { text: `❌ Format salah. Gunakan *YYYY-MM-DD* (Tahun-Bulan-Tgl).`, mentions: [sender] });
        }
        
        if (deadline < new Date()) {
             return await sock.sendMessage(from, { text: `⚠️ Tanggal sudah lewat. Masukkan tanggal masa depan.`, mentions: [sender] });
        }

        session.data.deadline = deadline;
        session.step = 4;
        
        const displayDeadline = deadline.toLocaleString("id-ID", { dateStyle: 'medium', timeStyle: 'short' });

        return await sock.sendMessage(from, {
            text: `📅 Deadline diset: *${displayDeadline}*\n\n*Langkah 4/5: Tipe Pengerjaan*\nApakah ini tugas Kelompok atau Individu?\n\nKetik *1* untuk 👥 KELOMPOK\nKetik *2* untuk 👤 INDIVIDU`,
            mentions: [sender]
        });
      }

      // [STEP 4] TIPE TUGAS
      if (session.step === 4) {
          const input = text.toLowerCase();
          let isGroupTask = null;

          if (['1', 'kelompok', 'group'].includes(input)) isGroupTask = true;
          else if (['2', 'individu', 'sendiri'].includes(input)) isGroupTask = false;
          else return await sock.sendMessage(from, { text: `⚠️ Pilih *1* atau *2*.` });
          
          session.data.isGroupTask = isGroupTask;
          session.step = 5;

          return await sock.sendMessage(from, {
              text: `✅ Tipe: *${isGroupTask ? 'KELOMPOK' : 'INDIVIDU'}*\n\n*Langkah Terakhir: Link Sumber*\nMasukkan link (Google Drive/Classroom) jika ada.\n\n👉 Ketik *strip (-)* jika tidak ada link.`,
              mentions: [sender]
          });
      }

      // [STEP 5] SIMPAN DATA
      if (session.step === 5) {
        let link = text.trim();
        if (['-', 'skip', 'tidak', 'ga ada'].includes(link.toLowerCase())) link = "-";

        // Simpan DB
        await db.prisma.task.create({
          data: {
            classId: session.classId,
            mapel: session.data.mapel,
            judul: session.data.judul,
            deadline: session.data.deadline,
            isGroupTask: session.data.isGroupTask, 
            link: link,
            attachmentData: session.data.attachmentData || null 
          }
        });

        sessions.delete(sender);

        // Format Konfirmasi Akhir yang Keren
        const finalDate = session.data.deadline.toLocaleString("id-ID", { 
            weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
        });
        const typeIcon = session.data.isGroupTask ? "👥 KELOMPOK" : "👤 INDIVIDU";
        const attachInfo = session.data.attachmentData ? "\n📎 _(Termasuk 1 Lampiran File)_" : "";

        let reply = `🎉 *SUKSES! TUGAS BARU DICATAT*\n`;
        reply += `─────────────────────\n`;
        reply += `📚 *${session.data.mapel}*\n`;
        reply += `📝 "${session.data.judul}"\n`;
        reply += `📅 Deadline: *${finalDate}*\n`;
        reply += `📌 Tipe: ${typeIcon}`;
        reply += `${attachInfo}\n`;
        
        if (link !== "-") reply += `🔗 Link: ${link}\n`;
        
        reply += `─────────────────────\n`;
        reply += `_Bot akan mengingatkan grup saat deadline mendekat._`;

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