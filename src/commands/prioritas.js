module.exports = {
  name: "#prioritas",
  description: "Minta AI untuk merekomendasikan prioritas tugas",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!model) {
      await sock.sendMessage(from, {
        text: "Maaf, fitur AI sedang tidak aktif. (API Key tidak diatur).",
      });
      return;
    }

    try {
      await sock.sendMessage(from, {
        text: "🧠 Menganalisis prioritas tugas... Mohon tunggu sebentar.",
      });

      const tasks = db.loadTasks();
      const pendingTasks = tasks.filter((t) => t.status === "Pending");

      if (pendingTasks.length === 0) {
        await sock.sendMessage(from, {
          text: "👍 Mantap! Tidak ada tugas yang sedang pending.",
        });
        return;
      }

      const taskListString = pendingTasks
        .map((t, i) => {
          const originalIndex =
            tasks.findIndex((originalTask) => originalTask.id === t.id) + 1;
          return `Tugas ${originalIndex}: Judul: ${t.judul}\n   Mapel: ${t.mapel}\n   Deadline: ${t.deadline}`;
        })
        .join("\n");

      const hariIni = new Date().toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const prompt = `
Anda adalah asisten AI yang membantu siswa memprioritaskan tugas sekolah.
Hari ini adalah: ${hariIni} (Zona Waktu Asia/Jakarta).

Berikut adalah daftar tugas yang masih 'Pending', beserta mata pelajaran dan deadline-nya:
${taskListString}

Tolong, berdasarkan deadline yang paling mendesak (paling dekat dengan hari ini), berikan rekomendasi 3 tugas yang harus dikerjakan terlebih dahulu.
Berikan jawaban dalam format ini:

*Prioritas Utama:* [Tugas X: Nama Tugas] - [Alasan Singkat (misal: 'Deadline besok!')]
*Prioritas Kedua:* [Tugas Y: Nama Tugas] - [Alasan Singkat]
*Prioritas Ketiga:* [Tugas Z: Nama Tugas] - [Alasan Singkat]

Beri juga satu saran atau motivasi singkat di bagian akhir.
Gunakan Bahasa Indonesia yang santai tapi jelas.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();

      await sock.sendMessage(from, { text: aiText });
    } catch (err) {
      console.error("Error #prioritas (Gemini):", err);
      await sock.sendMessage(from, {
        text: "Terjadi kesalahan saat menghubungi AI. Coba lagi nanti.",
      });
    }
  },
};