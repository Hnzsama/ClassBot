// commands/general/detailGrup.js
module.exports = {
  name: "#detail-grup",
  description: "Melihat anggota kelompok berdasarkan ID Tugas.",
  execute: async (bot, from, sender, args, msg) => {
    if (args.length === 0) {
      return await bot.sock.sendMessage(from, { text: "❌ Masukkan ID Tugas. Cek ID di #list-grup." });
    }

    const idTugas = parseInt(args[0]);

    try {
      const tugas = await bot.db.prisma.groupAssignment.findFirst({
        where: { 
          id: idTugas,
          waGroupId: from // Validasi: hanya bisa lihat data grup sendiri
        },
        include: {
          subGroups: {
            include: {
              members: true // Ambil data member lengkap
            }
          }
        }
      });

      if (!tugas) {
        return await bot.sock.sendMessage(from, { text: "❌ Data tugas tidak ditemukan." });
      }

      let outputText = `📂 *DETAIL KELOMPOK*\n`;
      outputText += `📚 Tugas: *${tugas.judul}*\n`;
      outputText += `📅 Dibuat: ${tugas.createdAt.toLocaleDateString("id-ID")}\n`;
      outputText += `───────────────────\n`;

      tugas.subGroups.forEach((sub) => {
        outputText += `\n*${sub.namaSubGrup}*\n`;
        
        if (sub.members.length === 0) {
           outputText += `  (Kosong)\n`;
        } else {
          // Sortir berdasarkan nama panggilan agar rapi
          const sortedMembers = sub.members.sort((a, b) => {
            const nameA = a.panggilan || a.nama;
            const nameB = b.panggilan || b.nama;
            return nameA.localeCompare(nameB);
          });

          sortedMembers.forEach((m) => {
            // Tampilkan Panggilan (jika ada), kalau tidak ada tampilkan Nama Lengkap
            const displayName = m.panggilan || m.nama;
            outputText += `┣ ${displayName}\n`;
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