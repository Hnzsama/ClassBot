// src/commands/mapel/addAi.js

// Import fungsi penyimpanan dari file manual (asumsi: tersedia)
const { addSubjectsToDb } = require("./add");

module.exports = {
  name: "#add-mapel-ai",
  description: "Tambah mapel (AI support). Format: #add-mapel-ai [Deskripsi]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;

    if (!from.endsWith("@g.us")) return;
    const namaMapelInput = text.replace("#add-mapel-ai", "").trim();
    if (!namaMapelInput) {
      return bot.sock.sendMessage(from, { text: "⚠️ Masukkan deskripsi mata kuliah yang ingin dibuat.\nContoh: `#add-mapel-ai semua matkul wajib semester 3`" });
    }
    if (!model) {
      return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif. Gunakan #add-mapel untuk input manual." });
    }

    try {
      // 1. Setup Awal (Cek Kelas)
      // FIX KRUSIAL: Mengganti findUnique({ groupId: ... }) dengan findFirst({ OR: [mainGroupId, inputGroupId] })
      const kelas = await db.prisma.class.findFirst({
        where: { 
          OR: [
            { mainGroupId: from },
            { inputGroupId: from }
          ]
        },
        include: { semesters: { where: { isActive: true } } }
      });

      if (!kelas || kelas.semesters.length === 0) {
        return bot.sock.sendMessage(from, { text: "❌ Tidak ada Semester Aktif. Pastikan kelas sudah di-setup." });
      }
      const activeSem = kelas.semesters[0];

      // 2. Panggil AI
      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      const prompt = `
      Anda adalah Task Extractor. Tugas Anda adalah MENGHASILKAN daftar mata kuliah (subjects) dari deskripsi berikut.
      Deskripsi: "${namaMapelInput}"
      🛑 INSTRUKSI OUTPUT SANGAT KETAT:
      1. Outputkan HANYA DAN HANYA daftar nama mata kuliah dalam format JSON array of strings.
      2. Jangan sertakan teks penjelasan, simbol, atau nomor urut di luar format JSON.
      3. Contoh output yang valid: ["Nama Mata Kuliah 1", "Nama Mata Kuliah 2"]
      `;

      const result = await model.generateContent(prompt);
      // FIX: Menggunakan .text() method dan pembersihan agresif
      let jsonText = result.response.text()
        .trim()
        .replace(/```json|```/g, "") // Hapus wrapper markdown
        .trim();
      
      let generatedNames;
      try {
        generatedNames = JSON.parse(jsonText);
      } catch (parseError) {
        console.error("JSON Parse Error on AI response:", jsonText); // Log raw output for further inspection
        return sock.sendMessage(from, { text: "❌ AI gagal. Hasil tidak valid. Coba input yang lebih singkat/jelas." });
      }

      // Pastikan hasil parse adalah array dan tidak kosong
      if (!Array.isArray(generatedNames) || generatedNames.length === 0) {
        return sock.sendMessage(from, { text: "❌ AI gagal menghasilkan daftar mata kuliah yang valid." });
      }

      // 3. Lanjut ke logic penyimpanan (di file add.js)
      // Kita asumsikan addSubjectsToDb dapat menangani array of strings
      return addSubjectsToDb(bot, from, sender, generatedNames, activeSem.id, kelas.name, true);

    } catch (e) {
      console.error("AI Add Subject Error:", e);
      // Feedback lebih jelas
      await bot.sock.sendMessage(from, { text: "❌ Gagal menghubungi AI atau terjadi error umum. Coba lagi." });
    }
  }
};