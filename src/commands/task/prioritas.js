module.exports = {
  name: "#task-prioritas",
  description: "Minta AI untuk merekomendasikan prioritas tugas.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    // 1. Cek Ketersediaan AI
    if (!model) {
      return await sock.sendMessage(from, {
        text: "⚠️ Fitur AI tidak aktif (API Key belum disetting).",
      });
    }

    try {
      // Kirim reaksi "berpikir" agar user tau bot sedang bekerja
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // 2. Ambil Data Kelas
      const kelas = await db.prisma.class.findUnique({ 
        where: { groupId: from } 
      });

      if (!kelas) {
        return await sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      }

      // 3. Ambil Tugas PENDING dari Database
      const tasks = await db.prisma.task.findMany({
        where: {
          classId: kelas.id,
          status: "Pending"
        },
        orderBy: { deadline: 'asc' } // Urutkan dari yang paling mepet
      });

      if (tasks.length === 0) {
        return await sock.sendMessage(from, {
          text: "🎉 *KABAR GEMBIRA!*\n\nTidak ada tugas pending saat ini.\nSilahkan rebahan atau push rank! 🎮",
        });
      }

      // 4. Format Data untuk AI
      const today = new Date();
      const listStr = tasks.map((t) => {
        const deadlineStr = new Date(t.deadline).toLocaleDateString("id-ID");
        return `- [ID: ${t.id}] Mapel: ${t.mapel} | Judul: "${t.judul}" | Deadline: ${deadlineStr}`;
      }).join("\n");

      // 5. Prompt Engineering (Instruksi ke AI)
      const prompt = `
Anda adalah "Class Bot Assistant", asisten akademik yang cerdas, gaul, dan sangat terorganisir.
Tugas Anda adalah menganalisis daftar tugas sekolah dan memberikan rekomendasi prioritas.

📅 *Tanggal Hari Ini:* ${today.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

📋 *Daftar Tugas Pending:*
${listStr}

⚡ *Instruksi:*
1. Analisis urgensi berdasarkan deadline.
2. Pilih maksimal 3 tugas yang paling KRUSIAL untuk dikerjakan segera (Top 3).
3. Berikan alasan singkat dan logis kenapa itu harus didahulukan.
4. Gunakan gaya bahasa yang santai, suportif, tapi tegas mengingatkan.
5. Format output harus rapi menggunakan emoji.

🛑 *Format Jawaban (Gunakan format ini):*
(Jangan gunakan markdown Heading '#' besar)

🤖 *ANALISIS PRIORITAS AI*
-------------------------

🥇 *PRIORITAS UTAMA*
📚 *[Nama Mapel]* - [Judul]
⏳ Deadline: [Tanggal]
💡 _Alasan: [Penjelasan singkat]_

🥈 *PRIORITAS KEDUA*
📚 *[Nama Mapel]* - [Judul]
⏳ Deadline: [Tanggal]
💡 _Alasan: ..._

🥉 *PRIORITAS KETIGA*
📚 *[Nama Mapel]* - [Judul]
⏳ Deadline: [Tanggal]
💡 _Alasan: ..._

-------------------------
💪 *Saran:* [Satu kalimat motivasi pendek & punchy]
`;

      // 6. Eksekusi ke Gemini AI
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiResponse = response.text();

      // 7. Kirim Hasil
      await sock.sendMessage(from, { 
        text: aiResponse,
        mentions: [sender] // Tag pemanggil
      });

    } catch (err) {
      console.error("Error #prioritas:", err);
      await sock.sendMessage(from, {
        text: "❌ Maaf, otak AI sedang korslet. Coba lagi nanti ya.",
      });
    }
  },
};