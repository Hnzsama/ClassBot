module.exports = {
  name: "#group-random",
  alias: ["#random"],
  description: "Randomize group. Format: #group-random [count] [Task Title]",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;

    if (args.length < 2) {
      return await sock.sendMessage(from, {
        text: "⚠️ *Format Salah*\n\nGunakan: `#randomgrup [jumlah] [Judul]`",
      });
    }

    let exceptions = [];
    let judulTugas = "";
    let jumlahKelompok = parseInt(args[0]);

    // Find --exc flag
    const excIndex = args.indexOf("--exc");
    if (excIndex !== -1) {
      // Parse exceptions
      const rawExceptions = args.slice(excIndex + 1).join(",");
      exceptions = rawExceptions.split(",").map(e => e.trim()).filter(e => e.length > 0);
      // Title is everything between count and --exc
      judulTugas = args.slice(1, excIndex).join(" ");
    } else {
      judulTugas = args.slice(1).join(" ");
    }

    if (isNaN(jumlahKelompok) || jumlahKelompok <= 0) {
      return await sock.sendMessage(from, { text: "❌ Jumlah kelompok harus angka > 0." });
    }

    try {
      const kelas = await db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) return await sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      const classId = kelas.id;

      const members = await db.prisma.member.findMany({
        where: { classId: classId },
        orderBy: { nama: 'asc' }
      });

      if (members.length === 0) return await sock.sendMessage(from, { text: "❌ Data member kosong." });

      // 3. Validasi & Filter Members (Exceptions)
      const allNimSuffixes = members.map(m => m.nim.slice(-3));
      const invalidNims = exceptions.filter(e => !allNimSuffixes.includes(e));

      if (invalidNims.length > 0) {
        return await sock.sendMessage(from, {
          text: `⚠️ *Exception Tidak Valid*\n\nNIM berikut tidak ditemukan di kelas ini:\n- ${invalidNims.join("\n- ")}\n\nPastikan menggunakan 3 digit NIM terakhir yang benar.`
        });
      }

      const eligibleMembers = members.filter(m => {
        const nimSuffix = m.nim.slice(-3);
        return !exceptions.includes(nimSuffix);
      });

      if (eligibleMembers.length === 0) return await sock.sendMessage(from, { text: "❌ Tidak ada anggota yang tersisa setelah difilter exception." });
      if (jumlahKelompok > eligibleMembers.length) return await sock.sendMessage(from, { text: `❌ Jumlah kelompok terlalu banyak (Hanya ada ${eligibleMembers.length} anggota tersedia).` });

      // Logic Acak
      const shuffled = [...eligibleMembers];
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

      // Simpan DB
      const savedAssignment = await db.prisma.groupAssignment.create({
        data: {
          judul: judulTugas,
          waGroupId: kelas.mainGroupId,
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

      // Output Tree Style (Icon Grup)
      const todayStr = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

      let outputText = `🎲 *HASIL ACAK KELOMPOK*\n`;
      outputText += `╭──────────────────────\n`;
      outputText += `│ 📚 Tugas: *${savedAssignment.judul}*\n`;
      outputText += `│ 🏫 Kelas: ${kelas.name}\n`;
      outputText += `│ 📅 Tanggal: ${todayStr}\n`;
      if (exceptions.length > 0) {
        outputText += `│ 🚫 Exception: ${exceptions.join(", ")}\n`;
      }
      outputText += `╰──────────────────────\n`;

      savedAssignment.subGroups.forEach((sub) => {
        // Ganti kardus 📦 jadi 👥
        outputText += `\n╭── [ 👥 *${sub.namaSubGrup.toUpperCase()}* (${sub.members.length}) ]\n`;

        if (sub.members.length === 0) {
          outputText += `╰ (Kosong)\n`;
        } else {
          const sortedMembers = sub.members.sort((a, b) => a.nama.localeCompare(b.nama));

          sortedMembers.forEach((m, i) => {
            const isLast = i === sortedMembers.length - 1;
            const branch = isLast ? '╰' : '├';
            outputText += `${branch} ${i + 1}. ${m.nama}\n`;
          });
        }
      });

      outputText += `\n──────────────────────\n`;
      outputText += `💡 _ID Arsip: #${savedAssignment.id}_`;

      await sock.sendMessage(from, {
        text: outputText,
        mentions: [sender]
      });

    } catch (err) {
      console.error("Error random grup:", err);
      await sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem." });
    }
  },
};