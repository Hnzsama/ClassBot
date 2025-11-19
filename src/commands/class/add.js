module.exports = {
  name: "#add-class",
  description: "Daftarkan grup ini sebagai kelas baru. Format: #add-class [Nama Kelas] | [Deskripsi]",
  execute: async (bot, from, sender, args, msg, text) => {
    // 1. Validasi hanya di Grup
    if (!from.endsWith("@g.us")) {
      return bot.sock.sendMessage(from, { text: "❌ Perintah ini hanya untuk Grup WhatsApp." });
    }

    const rawContent = text.replace("#add-class", "").trim();
    if (!rawContent) {
      return bot.sock.sendMessage(from, { 
        text: "⚠️ Masukkan nama kelas.\nContoh: `#add-class Inter 2025I`" 
      });
    }

    const parts = rawContent.split("|").map(p => p.trim());
    const namaKelas = parts[0];
    const deskripsi = parts[1] || "Kelas Baru";

    try {
      // 2. Cek apakah grup sudah terdaftar
      const exist = await bot.db.prisma.class.findUnique({
        where: { groupId: from }
      });

      if (exist) {
        return await bot.sock.sendMessage(from, { 
          text: `❌ Grup ini sudah terdaftar sebagai kelas *${exist.name}*.\nGunakan #info-class untuk cek data.` 
        });
      }

      // 3. BUAT KELAS BARU + SEMESTER 1 SEKALIGUS
      const newClass = await bot.db.prisma.class.create({
        data: {
          groupId: from,
          name: namaKelas,
          description: deskripsi,
          // Nested Create: Langsung buatkan Semester 1
          semesters: {
            create: {
              name: "Semester 1",
              isActive: true // Langsung aktifkan
            }
          }
        },
        include: {
          semesters: true // Ambil balikan data semesternya
        }
      });

      const sem1 = newClass.semesters[0];

      // 4. Respon Sukses
      let reply = `✅ *PENDAFTARAN KELAS BERHASIL!*\n\n`;
      reply += `🏫 Kelas: *${newClass.name}*\n`;
      reply += `📝 Deskripsi: ${newClass.description}\n`;
      reply += `📅 Semester Aktif: *${sem1.name}* (Dibuat Otomatis)\n`;
      
      // --- TAMBAHAN INSTRUKSI ---
      reply += `\n⚠️ _Catatan: Jika semester saat ini berbeda, ubah namanya menggunakan perintah:_\n`;
      reply += `\`#edit-semester ${sem1.id} name [Nama Baru]\`\n`;
      // --------------------------

      reply += `────────────────\n`;
      reply += `Langkah selanjutnya:\n`;
      reply += `1. Tambahkan Mapel: \`#add-mapel NamaMapel\`\n`;
      reply += `2. Tambahkan Siswa: \`#add-member NIM | Nama\`\n`;
      reply += `3. Tambahkan Tugas: \`#add-task Mapel | Judul | Tgl\``;

      await bot.sock.sendMessage(from, {
        text: reply,
        mentions: [sender]
      });

    } catch (e) {
      console.error("Error add-class:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mendaftarkan kelas. Terjadi kesalahan database." });
    }
  }
};