// src/commands/tugas/prioritas.js
module.exports = {
  name: "#task-prioritas",
  description: "Minta AI untuk merekomendasikan prioritas tugas.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!model) {
      return await sock.sendMessage(from, { text: "⚠️ Fitur AI tidak aktif." });
    }

    try {
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // 1. Ambil Data Kelas (Fixed: Dual Group Check)
      const kelas = await db.prisma.class.findFirst({
        where: { 
            OR: [
                { mainGroupId: from },
                { inputGroupId: from }
            ]
        }
      });

      if (!kelas) {
        return await sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      }

      // 2. Ambil Tugas PENDING
      const tasks = await db.prisma.task.findMany({
        where: {
          classId: kelas.id,
          status: "Pending"
        },
        orderBy: { deadline: 'asc' }
      });

      if (tasks.length === 0) {
        return await sock.sendMessage(from, {
          text: "🎉 *KABAR GEMBIRA!*\n\nTidak ada tugas pending saat ini.",
        });
      }

      // 3. Format Data untuk AI (Gunakan ISO Date)
      const listStr = tasks.map((t) => {
        const deadlineStr = t.deadline.toISOString().split('T')[0]; 
        return `- [ID: ${t.id}] Mapel: ${t.mapel} | Judul: "${t.judul}" | Deadline: ${deadlineStr}`;
      }).join("\n");

      const todayLocale = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      // 4. Prompt Engineering
      const prompt = `
Anda adalah "Class Bot Assistant".
Tugas Anda: Menganalisis daftar tugas pending dan memberikan rekomendasi prioritas.

📅 *Hari Ini:* ${todayLocale}

📋 *Tugas Pending:*
${listStr}

🛑 *Instruksi:*
1. Analisis urgensi berdasarkan deadline (YYYY-MM-DD).
2. Pilih 3 tugas paling KRUSIAL (deadline terdekat).
3. Jawab dalam format di bawah ini.

🛑 *Format Jawaban:*

🤖 *ANALISIS PRIORITAS AI*
-------------------------

🥇 *PRIORITAS UTAMA*
📚 *[Nama Mapel]* - [Judul]
⏳ Deadline: [Tanggal]
💡 _Alasan: [Singkat]_

🥈 *PRIORITAS KEDUA*
...

🥉 *PRIORITAS KETIGA*
...

-------------------------
💪 *Saran:* [Satu kalimat motivasi pendek]
`;

      const result = await model.generateContent(prompt);
      const aiText = result.response.text();

      await sock.sendMessage(from, { 
        text: aiText,
        mentions: [sender]
      });

    } catch (err) {
      console.error("Error #prioritas:", err);
      await sock.sendMessage(from, { text: "❌ Maaf, koneksi atau pemrosesan AI gagal." });
    }
  },
};