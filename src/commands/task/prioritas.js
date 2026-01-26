// src/commands/tugas/prioritas.js
module.exports = {
  name: "#task-priority",
  alias: ["#task-pri"],
  description: "Analyze task priority via AI.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!model) {
      return await sock.sendMessage(from, { text: "⚠️ Fitur AI belum dikonfigurasi." });
    }

    try {
      // React loading biar user tau bot sedang mikir
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // 1. Validasi Kelas (Dual Group Check)
      const kelas = await db.prisma.class.findFirst({
        where: {
          OR: [
            { mainGroupId: from },
            { inputGroupId: from }
          ]
        }
      });

      if (!kelas) return await sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Ambil Tugas PENDING
      const tasks = await db.prisma.task.findMany({
        where: {
          classId: kelas.id,
          status: "Pending"
        },
        orderBy: { deadline: 'asc' }, // Urutkan dari deadline terdekat
        take: 10 // Ambil 10 terdekat saja agar token AI tidak jebol
      });

      if (tasks.length === 0) {
        return await sock.sendMessage(from, {
          text: "🎉 *RELAX MODE ON*\n\nAnalisis selesai: Tidak ada tugas pending. Nikmati waktumu!",
        });
      }

      // 3. Smart Data Prep (Hitung sisa hari & Tipe sebelum kirim ke AI)
      const now = new Date();
      const taskListStr = tasks.map((t) => {
        const deadlineDate = new Date(t.deadline);
        const diffTime = deadlineDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const timeStatus = diffDays < 0 ? "TERLEWAT" : (diffDays === 0 ? "HARI INI" : `${diffDays} hari lagi`);
        const type = t.isGroupTask ? "KELOMPOK (Butuh Koordinasi)" : "INDIVIDU";

        return `- [ID:${t.id}] Mapel: ${t.mapel} | Judul: "${t.judul}" | Status: ${timeStatus} | Tipe: ${type}`;
      }).join("\n");

      // 4. Advanced Prompt Engineering
      const prompt = `
Anda adalah Asisten Strategi Akademik yang cerdas dan to-the-point.
Tugas: Analisis daftar tugas berikut dan tentukan 3 PRIORITAS UTAMA yang harus dikerjakan segera.

📋 *DATA TUGAS:*
${taskListStr}

🧠 *LOGIKA PRIORITAS:*
1. Tugas yang "TERLEWAT" atau "HARI INI" adalah darurat mutlak.
2. Jika deadline sama, tugas "KELOMPOK" lebih prioritas daripada "INDIVIDU" (karena butuh waktu koordinasi teman).
3. Berikan alasan singkat dan logis.

🛑 *FORMAT OUTPUT (WAJIB IKUTI):*
Jangan gunakan markdown code block. Gunakan format teks WhatsApp berikut:

🧠 *STRATEGI PRIORITAS AI*
⏳ _Analisis untuk ${tasks.length} tugas pending_
─────────────────────

🥇 *URGENSI 1: [Nama Mapel]*
   └ 📝 "${'[Judul Tugas]'}"
   └ 🚨 *[Status Waktu]*
   └ 💡 _[Alasan AI: Kenapa ini harus duluan?]_

🥈 *URGENSI 2: [Nama Mapel]*
   └ 📝 "${'[Judul Tugas]'}"
   └ ⏰ *[Status Waktu]*
   └ 💡 _[Alasan AI]_

🥉 *URGENSI 3: [Nama Mapel]*
   └ 📝 "${'[Judul Tugas]'}"
   └ ⏰ *[Status Waktu]*
   └ 💡 _[Alasan AI]_

─────────────────────
💪 *Saran Taktis:*
[Satu kalimat saran strategi pengerjaan yang cerdas & menyemangati]
`;

      // 5. Generate Content
      const result = await model.generateContent(prompt);
      const aiText = result.response.text();

      // 6. Kirim Hasil
      await sock.sendMessage(from, {
        text: aiText,
        mentions: [sender]
      });

    } catch (err) {
      console.error("Error #prioritas:", err);
      await sock.sendMessage(from, { text: "❌ Gagal memproses analisis AI." });
    }
  },
};