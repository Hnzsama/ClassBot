// src/commands/kelas/add.js
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
      // 2. Cek Validasi Menyeluruh
      const exist = await bot.db.prisma.class.findFirst({
        where: {
            OR: [
                { mainGroupId: from }, 
                { inputGroupId: from } 
            ]
        }
      });

      if (exist) {
        // Logika pesan error yang lebih natural
        if (exist.mainGroupId === from) {
            return await bot.sock.sendMessage(from, { text: `❌ Grup ini SUDAH terdaftar sebagai Pusat Informasi Kelas *${exist.name}*.` });
        } else {
            return await bot.sock.sendMessage(from, { 
                text: `❌ GAGAL: Grup ini sudah menjadi bagian dari komunitas kelas *${exist.name}*.\nTidak bisa mendaftarkan kelas baru di sini.` 
            });
        }
      }

      // 3. BUAT KELAS BARU + SEMESTER 1 SEKALIGUS
      const newClass = await bot.db.prisma.class.create({
        data: {
          mainGroupId: from, 
          name: namaKelas,
          description: deskripsi,
          semesters: {
            create: {
              name: "Semester 1",
              isActive: true 
            }
          }
        },
        include: { semesters: true }
      });

      const sem1 = newClass.semesters[0];

      // 4. Respon Sukses
      let reply = `✅ *PENDAFTARAN KELAS BERHASIL!*\n\n`;
      reply += `🏫 Kelas: *${newClass.name}*\n`;
      reply += `📝 Deskripsi: ${newClass.description}\n`;
      reply += `📅 Semester Aktif: *${sem1.name}* (Dibuat Otomatis)\n`;
      
      // --- INSTRUKSI KOMUNITAS (Natural Wording) ---
      reply += `\n────────────────\n`;
      reply += `*🌐 HUBUNGKAN KOMUNITAS ANDA*\n`;
      reply += `Ingin memisahkan chat diskusi dari info penting?\n\n`;
      reply += `Class ID: \`${newClass.id}\`\n`; 
      reply += `Main Group ID: \`${newClass.mainGroupId}\`\n`; 
      reply += `\nSalin kode di atas, lalu jalankan perintah ini di grup diskusi/komunitas lain agar terhubung:\n`;
      reply += `\`#assign-class ${newClass.id} ${newClass.mainGroupId}\`\n`; 
      reply += `────────────────\n`;
      
      reply += `Langkah selanjutnya:\n`;
      reply += `1. Tambahkan Mapel: \`#add-mapel NamaMapel\`\n`;
      reply += `2. Tambahkan Siswa: \`#add-member NIM | Nama\`\n`;
      reply += `3. Tambahkan Tugas: \`#add-task Mapel | Judul | Tgl\``;

      await bot.sock.sendMessage(from, { text: reply, mentions: [sender] });

    } catch (e) {
      console.error("Error add-class:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mendaftarkan kelas. Terjadi kesalahan database." });
    }
  }
};