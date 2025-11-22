// src/commands/group/detailGrup.js
module.exports = {
  name: "#detail-grup",
  description: "Melihat anggota kelompok berdasarkan ID Tugas.",
  execute: async (bot, from, sender, args, msg) => {
    if (args.length === 0) {
      return await bot.sock.sendMessage(from, { text: "❌ Masukkan ID Tugas. Cek ID di `#list-grup`." });
    }

    const idTugas = parseInt(args[0]);
    if (isNaN(idTugas)) return bot.sock.sendMessage(from, { text: "❌ ID harus angka." });

    try {
      // 1. Cari Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 2. Ambil Detail Tugas & Member
      const tugas = await bot.db.prisma.groupAssignment.findFirst({
        where: { 
          id: idTugas,
          classId: kelas.id 
        },
        include: {
          subGroups: {
            include: {
              members: { orderBy: { nama: 'asc' } } 
            }
          }
        }
      });

      if (!tugas) {
        return await bot.sock.sendMessage(from, { text: "❌ Data kelompok tidak ditemukan di kelas ini." });
      }

      // 3. Format Output Keren
      const tglDibuat = tugas.createdAt.toLocaleDateString("id-ID", { 
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
      });

      let outputText = `╭── 👥 *DETAIL PEMBAGIAN KELOMPOK*\n`;
      outputText += `│ 📚 Tugas: *${tugas.judul}*\n`;
      outputText += `│ 📅 Dibuat: ${tglDibuat}\n`;
      outputText += `│ 🆔 ID Arsip: #${tugas.id}\n`;
      outputText += `╰────────────────────────\n`;

      tugas.subGroups.forEach((sub) => {
        outputText += `\n🔰 *${sub.namaSubGrup.toUpperCase()}*\n`;
        
        if (sub.members.length === 0) {
           outputText += `   _(Tidak ada anggota)_\n`;
        } else {
          sub.members.forEach((m, i) => {
            // Menggunakan Nama Lengkap (m.nama)
            outputText += `   ${i + 1}. ${m.nama}\n`;
          });
        }
      });

      outputText += `\n────────────────────────\n`;
      outputText += `_Total: ${tugas.subGroups.length} Kelompok_`;

      await bot.sock.sendMessage(from, { text: outputText });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil detail grup." });
    }
  },
};