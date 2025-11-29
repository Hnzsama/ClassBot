module.exports = {
  name: "#add-class", // KEMBALI KE PAGAR
  description: "Daftarkan kelas baru. Format: #add-class [Nama Kelas], [Deskripsi]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) {
      return bot.sock.sendMessage(from, { text: "❌ Perintah ini hanya untuk Grup WhatsApp." });
    }

    const rawContent = text.replace("#add-class", "").trim();

    if (!rawContent) {
      return bot.sock.sendMessage(from, { 
        text: "⚠️ Masukkan nama kelas.\n\nGunakan koma untuk pemisah deskripsi (opsional).\nContoh: `#add-class Inter 2025I, Kelas Unggulan`" 
      });
    }

    // Tetap pakai koma (,) agar mudah di HP
    let parts = rawContent.split(","); 
    const namaKelas = parts[0].trim();
    const deskripsi = parts.length > 1 ? parts.slice(1).join(",").trim() : "Kelas Baru"; 

    try {
      const exist = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (exist) {
        return bot.sock.sendMessage(from, { text: `❌ Grup ini sudah terdaftar untuk kelas *${exist.name}*.` });
      }

      const newClass = await bot.db.prisma.class.create({
        data: {
          mainGroupId: from, 
          name: namaKelas,
          description: deskripsi,
          semesters: {
            create: { name: "Semester 1", isActive: true }
          }
        },
        include: { semesters: true }
      });

      const sem1 = newClass.semesters[0];

      let reply = `✅ *PENDAFTARAN KELAS BERHASIL!*\n\n`;
      reply += `🏫 Kelas: *${newClass.name}*\n`;
      reply += `📝 Deskripsi: ${newClass.description}\n`;
      reply += `📅 Semester Aktif: *${sem1.name}*\n`;
      
      reply += `\n────────────────\n`;
      reply += `*🌐 HUBUNGKAN KOMUNITAS*\n`;
      reply += `Class ID: \`${newClass.id}\`\n`; 
      reply += `Main Group ID: \`${newClass.mainGroupId}\`\n`; 
      reply += `\nSalin kode di atas untuk grup diskusi lain:\n`;
      reply += `\`#assign-class ${newClass.id} ${newClass.mainGroupId}\`\n`; // Contoh command lain ikut #
      reply += `────────────────\n`;
      
      reply += `Next Steps:\n`;
      reply += `1. Tambah Mapel: \`#add-mapel NamaMapel\`\n`;
      reply += `2. Tambah Siswa: \`#add-member NIM, Nama\`\n`;
      reply += `3. Tambah Tugas: \`#add-task Mapel, Judul, Tgl\``;

      await bot.sock.sendMessage(from, { text: reply, mentions: [sender] });

    } catch (e) {
      console.error("Error add-class:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mendaftarkan kelas." });
    }
  }
};