module.exports = {
  name: "#detail-grup",
  description: "Lihat detail pembagian kelompok. Format: #detail-grup [ID Arsip]",
  execute: async (bot, from, sender, args, msg) => {
    if (args.length === 0) {
      return await bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID Arsip. Cek di `#list-grup`." });
    }

    const idTugas = parseInt(args[0]);
    if (isNaN(idTugas)) return bot.sock.sendMessage(from, { text: "❌ ID harus angka." });

    try {
      const kelas = await bot.db.prisma.class.findFirst({
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      const tugas = await bot.db.prisma.groupAssignment.findFirst({
        where: { id: idTugas, classId: kelas.id },
        include: { subGroups: { include: { members: { orderBy: { nama: 'asc' } } } } }
      });

      if (!tugas) return await bot.sock.sendMessage(from, { text: "❌ Data kelompok tidak ditemukan." });

      const tglDibuat = tugas.createdAt.toLocaleDateString("id-ID", { 
          weekday: 'long', day: 'numeric', month: 'short'
      });

      let outputText = `📋 *ARSIP KELOMPOK*\n`;
      outputText += `╭──────────────────────\n`;
      outputText += `│ 📚 Tugas: *${tugas.judul}*\n`;
      outputText += `│ 📅 Dibuat: ${tglDibuat}\n`;
      outputText += `│ 🆔 ID: #${tugas.id}\n`;
      outputText += `╰──────────────────────\n`;

      tugas.subGroups.forEach((sub) => {
        // Ganti kardus 📦 jadi 👥
        outputText += `\n╭── [ 👥 *${sub.namaSubGrup.toUpperCase()}* ]\n`;
        
        if (sub.members.length === 0) {
           outputText += `╰ (Kosong)\n`;
        } else {
          sub.members.forEach((m, i) => {
            const isLast = i === sub.members.length - 1;
            const branch = isLast ? '╰' : '├';
            outputText += `${branch} ${i + 1}. ${m.nama}\n`;
          });
        }
      });

      await bot.sock.sendMessage(from, { text: outputText });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil detail grup." });
    }
  },
};