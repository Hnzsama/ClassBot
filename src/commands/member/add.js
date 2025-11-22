// src/commands/member/add.js

// --- 1. FUNGSI UTAMA DATABASE (SHARED UTILITY) ---
async function addMembersToDb(bot, from, sender, lines, classId, className, isAI = false) {
    const { sock, db } = bot;
    
    const membersToCreate = [];
    const errors = [];
    const nimsInInput = new Set();
    
    // 1. Parsing dan Validasi Awal Input
    for (const line of lines) {
        // Asumsi format input: NIM | Nama | Panggilan
        const parts = line.split("|").map(p => p.trim());
        const nim = parts[0];
        const nama = parts[1];
        const panggilan = parts[2] || null;

        // Validasi Kritis
        if (!nim || !nama) {
            errors.push(`[${nim || 'NIM Kosong'}] Gagal: NIM dan Nama wajib ada.`);
            continue;
        }

        if (nimsInInput.has(nim)) {
            errors.push(`[${nim}] Gagal: NIM duplikat dalam daftar input.`);
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
        return sock.sendMessage(from, { text: `❌ Tidak ada data member valid yang diproses. ${errors.join('\n')}` });
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
            errors.push(`[${member.nim}] Gagal: NIM sudah terdaftar (Unique Global).`);
            return false;
        }
        return true;
    });

    // 3. Eksekusi Create Many
    if (finalPayload.length === 0) {
         let errMsg = isAI ? "❌ AI menghasilkan data yang semuanya duplikat." : "❌ Semua NIM sudah terdaftar atau format salah.";
         if (errors.length > 0) errMsg += `\n\nDetail: ${errors.join('\n')}`;
         return sock.sendMessage(from, { text: errMsg });
    }
    
    const result = await db.prisma.member.createMany({
      data: finalPayload,
    });

    // 4. Kirim Konfirmasi
    let successMsg = `✅ *${result.count} Member Baru Ditambahkan* ke Kelas ${className}.\n`;
    if (errors.length > 0) successMsg += `\n⚠️ *Gagal Ditambahkan (${errors.length}):*\n${errors.join('\n')}`;

    await sock.sendMessage(from, {
      text: successMsg,
      mentions: [sender]
    });
}


module.exports = {
  name: "#add-member",
  description: "Tambah member (Batch support). Format: #add-member NIM | Nama | Panggilan (per baris)",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const rawContent = text.replace("#add-member", "").trim();
    
    if (rawContent.length === 0) {
      return await bot.sock.sendMessage(from, { text: "⚠️ Masukkan data member (NIM | Nama | Panggilan) per baris." });
    }
    
    const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
         return await bot.sock.sendMessage(from, { text: "⚠️ Tidak ada baris data valid yang terdeteksi." });
    }

    try {
      // FIX: Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan #add-class dulu." });

      // 2. Execute Core Saving Logic
      await addMembersToDb(bot, from, sender, lines, kelas.id, kelas.name, false);

    } catch (e) {
      console.error("Error add-member:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal tambah member." });
    }
  },
  // Export core logic for AI file
  addMembersToDb: addMembersToDb 
};