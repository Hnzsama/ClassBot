module.exports = {
  name: "#add-task",
  description: "Tambah tugas baru. Ketik #add-task untuk mode interaktif.",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    const userNumber = sender.split("@")[0];

    // 1. Cek Sesi Aktif
    if (bot.sessions.has(sender)) {
      return bot.sock.sendMessage(from, { 
        text: `⚠️ @${userNumber}, selesaikan input sebelumnya dulu atau ketik *batal*.`,
        mentions: [sender]
      });
    }

    // Cek apakah user pakai format pipa (legacy)
    if (text.includes("|")) {
       return bot.sock.sendMessage(from, { text: "⚠️ Fitur ini sekarang menggunakan mode interaktif. Cukup ketik: #add-task" });
    }

    try {
      // 2. Ambil Data Kelas & Mapel
      const kelas = await bot.db.prisma.class.findUnique({
        where: { groupId: from },
        include: { 
            semesters: { 
                where: { isActive: true }, 
                include: { subjects: { orderBy: { name: 'asc' } } } 
            } 
        }
      });

      if (!kelas || kelas.semesters.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Kelas/Semester belum siap. Hubungi Admin." });
      }

      const subjects = kelas.semesters[0].subjects;
      if (subjects.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Belum ada mapel. Gunakan #add-mapel dulu." });
      }

      // 3. Format List Mapel
      const listMapel = subjects
        .map((s, i) => `*${i + 1}.* ${s.name}`)
        .join("\n");

      // 4. Mulai Sesi
      bot.sessions.set(sender, {
        type: "ADD_TASK",
        groupId: from,
        step: 1,
        classId: kelas.id,
        data: {}
      });

      // 5. Kirim Pesan Pembuka (DENGAN INSTRUKSI BATAL)
      await bot.sock.sendMessage(from, { 
        text: `🔒 *INPUT TUGAS BARU*
Halo @${userNumber}! 👋
_(Ketik *batal* jika ingin keluar dari sesi ini)_

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