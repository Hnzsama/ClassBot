// src/commands/group/randomGrup.js
module.exports = {
  name: "#randomgrup",
  description: "Acak kelompok & Simpan ke Database. Format: #randomgrup [jumlah] [Judul Tugas]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;

    if (args.length < 2) {
      return await sock.sendMessage(from, {
        text: "⚠️ Format salah!\nGunakan: *#randomgrup [jumlah] [Judul]*\nContoh: `#randomgrup 5 Makalah Agama`",
      });
    }

    const jumlahKelompok = parseInt(args[0]);
    const judulTugas = args.slice(1).join(" ");

    if (isNaN(jumlahKelompok) || jumlahKelompok <= 0) {
      return await sock.sendMessage(from, { text: "❌ Jumlah kelompok harus angka > 0." });
    }

    try {
      // 1. AMBIL KELAS (Dual Group Check)
      const kelas = await db.prisma.class.findFirst({
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) {
          return await sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan #add-class dulu." });
      }
      const classId = kelas.id;

      // 2. AMBIL MEMBER KELAS
      const members = await db.prisma.member.findMany({
        where: { classId: classId },
        orderBy: { nama: 'asc' }
      });

      if (members.length === 0) {
        return await sock.sendMessage(from, { text: "❌ Data member kosong. Tambahkan member dulu." });
      }

      if (jumlahKelompok > members.length) {
        return await sock.sendMessage(from, { text: `❌ Jumlah kelompok (${jumlahKelompok}) lebih besar dari siswa (${members.length}).` });
      }

      // 3. LOGIKA ACAK (Fisher-Yates)
      const shuffled = [...members];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const groupsPayload = Array.from({ length: jumlahKelompok }, (_, i) => ({
        namaSubGrup: `Kelompok ${i + 1}`,
        members: [] 
      }));

      shuffled.forEach((member, index) => {
        const groupIndex = index % jumlahKelompok;
        groupsPayload[groupIndex].members.push({ id: member.id });
      });

      // 4. SIMPAN KE DATABASE
      const savedAssignment = await db.prisma.groupAssignment.create({
        data: {
          judul: judulTugas,
          waGroupId: kelas.mainGroupId, // Link ke grup utama
          classId: classId, 
          subGroups: {
            create: groupsPayload.map(g => ({
              namaSubGrup: g.namaSubGrup,
              members: { connect: g.members }
            }))
          }
        },
        include: { subGroups: { include: { members: true } } }
      });

      // 5. OUTPUT KEREN (Box Style + Nama Lengkap)
      let outputText = `╭── 🎲 *HASIL ACAK KELOMPOK*\n`;
      outputText += `│ 📚 Tugas: *${savedAssignment.judul}*\n`;
      outputText += `│ 💾 ID Riwayat: #${savedAssignment.id}\n`;
      outputText += `╰────────────────────────\n`;

      savedAssignment.subGroups.forEach((sub) => {
        outputText += `\n🔰 *${sub.namaSubGrup.toUpperCase()}*\n`;
        
        if (sub.members.length === 0) {
           outputText += `   _(Kosong)_\n`;
        } else {
          // Sortir nama lengkap agar urut abjad di dalam kelompok
          const sortedMembers = sub.members.sort((a, b) => a.nama.localeCompare(b.nama));
          sortedMembers.forEach((m, i) => {
            // Menggunakan Nama Lengkap (m.nama)
            outputText += `   ${i + 1}. ${m.nama}\n`;
          });
        }
      });

      outputText += `\n────────────────────────\n`;
      outputText += `💡 _Data tersimpan. Cek kembali dengan #list-grup_`;

      await sock.sendMessage(from, { text: outputText });

    } catch (err) {
      console.error("Error random grup:", err);
      await sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem." });
    }
  },
};