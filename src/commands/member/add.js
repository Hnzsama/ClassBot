async function addMembersToDb(bot, from, sender, lines, classId, className, isAI = false) {
    const { sock, db } = bot;
    
    const membersToCreate = [];
    const errors = [];
    const nimsInInput = new Set();
    
    // 1. Parsing dan Validasi Awal Input
    for (const line of lines) {
        const parts = line.split(",").map(p => p.trim());
        
        const nim = parts[0];
        const nama = parts[1];
        // Ambil panggilan jika ada, jika tidak null
        const panggilan = parts[2] || null;

        // Validasi Kritis
        if (!nim || !nama) {
            errors.push(`[${nim || 'DATA KOSONG'}] ❌ Gagal: Format harus "NIM, Nama"`);
            continue;
        }

        if (nimsInInput.has(nim)) {
            errors.push(`[${nim}] ⚠️ Skip: NIM duplikat di dalam list input.`);
            continue;
        }
        nimsInInput.add(nim);
        
        membersToCreate.push({
            nim, 
            nama, 
            panggilan,
            classId: classId
        });
    }

    if (membersToCreate.length === 0) {
        return sock.sendMessage(from, { text: `❌ Tidak ada data valid.\nFormat per baris: \`NIM, Nama, Panggilan\`\n\nError Detail:\n${errors.join('\n')}` });
    }

    // 2. Cek Duplikat di Database (NIM Global Unique)
    const nimsToCheck = Array.from(nimsInInput);
    const existingMembers = await db.prisma.member.findMany({
        where: { nim: { in: nimsToCheck } },
        select: { nim: true }
    });
    
    const existingNims = new Set(existingMembers.map(m => m.nim));
    
    const finalPayload = membersToCreate.filter(member => {
        if (existingNims.has(member.nim)) {
            errors.push(`[${member.nim}] ❌ Gagal: NIM sudah terdaftar di database.`);
            return false;
        }
        return true;
    });

    // 3. Eksekusi Create Many
    if (finalPayload.length === 0) {
         let errMsg = isAI ? "❌ AI gagal memproses data." : "❌ Semua data gagal ditambahkan.";
         if (errors.length > 0) errMsg += `\n\n📋 *Log Error:*\n${errors.join('\n')}`;
         return sock.sendMessage(from, { text: errMsg });
    }
    
    const result = await db.prisma.member.createMany({
      data: finalPayload,
    });

    // 4. Kirim Konfirmasi
    let successMsg = `✅ *${result.count} MEMBER BERHASIL DITAMBAHKAN*\n`;
    successMsg += `🏫 Kelas: ${className}\n`;
    
    if (errors.length > 0) {
        successMsg += `\n⚠️ *${errors.length} Data Gagal:*\n${errors.join('\n')}`;
    }

    await sock.sendMessage(from, {
      text: successMsg,
      mentions: [sender]
    });
}

module.exports = {
  name: "#add-member",
  description: "Tambah member. Format: NIM, Nama, Panggilan (Per Baris)",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const rawContent = text.replace("#add-member", "").trim();
    
    if (rawContent.length === 0) {
      return await bot.sock.sendMessage(from, { 
          text: "⚠️ *Format Tambah Member*\n\nMasukkan data per baris dipisah koma:\n`NIM, Nama Lengkap, Panggilan`\n\nContoh:\n`#add-member`\n`2025001, Ahmad Dahlan, Ahmad`\n`2025002, Budi Utomo, Budi`" 
      });
    }
    
    // Split berdasarkan baris baru (Enter)
    const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
         return await bot.sock.sendMessage(from, { text: "⚠️ Tidak ada data yang terbaca." });
    }

    try {
      // Cek Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar di grup ini." });

      // Jalankan Fungsi Simpan
      await addMembersToDb(bot, from, sender, lines, kelas.id, kelas.name, false);

    } catch (e) {
      console.error("Error add-member:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal proses tambah member." });
    }
  },
  // Export fungsi agar bisa dipakai fitur AI/Image to text nanti
  addMembersToDb: addMembersToDb 
};