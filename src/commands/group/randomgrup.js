// commands/randomGrup.js

module.exports = {
  name: "#randomgrup",
  description: "Acak kelompok & Simpan ke Database. Format: #randomgrup [jumlah] [Judul Tugas]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;

    // 1. Validasi Input
    if (args.length < 2) {
      return await sock.sendMessage(from, {
        text: "⚠️ Format salah!\nGunakan: *#randomgrup [jumlah_kelompok] [Judul Tugas]*\n\nContoh:\n`#randomgrup 5 Tugas Makalah Agama`",
      });
    }

    const jumlahKelompok = parseInt(args[0]);
    const judulTugas = args.slice(1).join(" ");

    if (isNaN(jumlahKelompok) || jumlahKelompok <= 0) {
      return await sock.sendMessage(from, { text: "❌ Jumlah kelompok harus angka lebih dari 0." });
    }

    try {
      // 2. Ambil Member
      const members = await db.prisma.member.findMany({
        where: { groupId: from },
        orderBy: { nama: 'asc' }
      });

      if (members.length === 0) {
        return await sock.sendMessage(from, { text: "❌ Data member kosong. Gunakan seed atau input member terlebih dahulu." });
      }

      if (jumlahKelompok > members.length) {
        return await sock.sendMessage(from, { 
            text: `❌ Jumlah kelompok (${jumlahKelompok}) lebih besar dari jumlah siswa (${members.length}).` 
        });
      }

      // 3. Logika Pengacakan
      const shuffled = [...members];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // 4. Siapkan Payload Prisma
      const groupsPayload = Array.from({ length: jumlahKelompok }, (_, i) => ({
        namaSubGrup: `Kelompok ${i + 1}`,
        members: [] 
      }));

      shuffled.forEach((member, index) => {
        const groupIndex = index % jumlahKelompok;
        groupsPayload[groupIndex].members.push({ id: member.id });
      });

      // 5. Simpan ke Database
      const savedAssignment = await db.prisma.groupAssignment.create({
        data: {
          judul: judulTugas,
          waGroupId: from,
          subGroups: {
            create: groupsPayload.map(g => ({
              namaSubGrup: g.namaSubGrup,
              members: {
                connect: g.members
              }
            }))
          }
        },
        include: {
          subGroups: {
            include: { members: true }
          }
        }
      });

      // 6. Output (MODIFIKASI DISINI: Tampilkan Nama Panggilan)
      let outputText = `🎲 *HASIL ACAK KELOMPOK* 🎲\n`;
      outputText += `📚 Tugas: *${savedAssignment.judul}*\n`;
      outputText += `💾 ID Riwayat: *${savedAssignment.id}*\n`;
      outputText += `───────────────────\n`;

      savedAssignment.subGroups.forEach((sub) => {
        outputText += `\n*${sub.namaSubGrup}*\n`;
        if (sub.members.length === 0) {
           outputText += `  (Kosong)\n`;
        } else {
          // Sortir berdasarkan nama panggilan agar urut abjad saat ditampilkan
          const sortedMembers = sub.members.sort((a, b) => {
            const nameA = a.panggilan || a.nama; // Prioritas panggilan
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

      outputText += `\n_Data tersimpan. Ketik #list-grup untuk melihat riwayat._`;

      await sock.sendMessage(from, { text: outputText });

    } catch (err) {
      console.error("Error random grup:", err);
      await sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem saat mengacak/menyimpan grup." });
    }
  },
};