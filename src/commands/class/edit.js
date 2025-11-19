module.exports = {
  name: "#edit-class",
  description: "Edit info kelas. Format: #edit-class [nama/deskripsi/semester] [Value]",
  execute: async (bot, from, sender, args, msg, text) => {
    // 1. Validasi Grup
    if (!from.endsWith("@g.us")) return;

    // Parsing Input
    // Contoh: #edit-class nama Kelas TI B
    // Contoh: #edit-class semester 5 (5 adalah ID Semester)
    const cleanText = text.replace("#edit-class", "").trim();
    const firstSpace = cleanText.indexOf(" ");
    
    if (firstSpace === -1) {
      return await bot.sock.sendMessage(from, { 
        text: "⚠️ Format Salah!\nGunakan:\n`#edit-class nama [Nama Baru]`\n`#edit-class deskripsi [Deskripsi Baru]`\n`#edit-class semester [ID Semester]`" 
      });
    }

    const field = cleanText.substring(0, firstSpace).toLowerCase();
    const value = cleanText.substring(firstSpace + 1).trim();

    try {
      // 2. Cek Keberadaan Kelas
      const kelas = await bot.db.prisma.class.findUnique({ 
        where: { groupId: from } 
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan #add-class dulu." });

      // === SKENARIO 1: GANTI SEMESTER AKTIF ===
      if (field === "semester") {
        const targetId = parseInt(value);
        if (isNaN(targetId)) return bot.sock.sendMessage(from, { text: "⚠️ ID Semester harus angka." });

        // Cek apakah ID Semester ini milik kelas ini?
        const targetSem = await bot.db.prisma.semester.findFirst({
          where: { id: targetId, classId: kelas.id }
        });

        if (!targetSem) {
          // Bantu user dengan menampilkan daftar semester yang ada
          const allSems = await bot.db.prisma.semester.findMany({ where: { classId: kelas.id } });
          const list = allSems.map(s => `- ID ${s.id}: ${s.name}`).join("\n");
          return bot.sock.sendMessage(from, { 
            text: `❌ Semester ID ${targetId} tidak ditemukan di kelas ini.\n\n📋 *Pilihan Semester Anda:*\n${list}` 
          });
        }

        // Transaction: Matikan semua semester di kelas ini -> Hidupkan target
        await bot.db.prisma.$transaction([
          bot.db.prisma.semester.updateMany({
            where: { classId: kelas.id },
            data: { isActive: false }
          }),
          bot.db.prisma.semester.update({
            where: { id: targetId },
            data: { isActive: true }
          })
        ]);

        return bot.sock.sendMessage(from, { 
          text: `✅ Berhasil pindah ke *${targetSem.name}*.\nSemester ini sekarang AKTIF.` 
        });
      }

      // === SKENARIO 2: UPDATE NAMA / DESKRIPSI ===
      let dbField = "";
      if (field === "nama" || field === "name") dbField = "name";
      else if (field === "deskripsi" || field === "description") dbField = "description";
      else {
        return bot.sock.sendMessage(from, { text: "❌ Opsi edit salah. Gunakan: nama, deskripsi, atau semester." });
      }

      await bot.db.prisma.class.update({
        where: { groupId: from },
        data: { [dbField]: value }
      });

      await bot.sock.sendMessage(from, {
        text: `✏️ *Info Kelas Diupdate*\n\nBagian: ${field.toUpperCase()}\nMenjadi: *${value}*\n\nOleh: @${sender.split("@")[0]}`,
        mentions: [sender]
      });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal update kelas." });
    }
  }
};