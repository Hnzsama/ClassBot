// src/commands/mapel/add.js

// --- FUNGSI UTAMA DATABASE (SHARED UTILITY) ---
async function addSubjectsToDb(bot, from, sender, namesArray, semesterId, className, isAI = false) {
    const { sock, db } = bot;
    
    const rawNames = namesArray.map(n => n.trim()).filter(n => n.length > 0);
    if (rawNames.length === 0) {
        return sock.sendMessage(from, { text: "⚠️ Tidak ada nama mata kuliah yang terdeteksi." });
    }

    // 1. Cek Duplikat di Database
    const existingSems = await db.prisma.semester.findMany({
        where: { classId: semesterId },
        include: { subjects: { select: { name: true } } }
    });
    
    const existingNames = new Set();
    existingSems.forEach(sem => sem.subjects.forEach(sub => existingNames.add(sub.name.toLowerCase())));


    const payload = [];
    const errors = [];
    const addedNames = [];

    rawNames.forEach(name => {
        if (existingNames.has(name.toLowerCase())) {
            errors.push(`[${name}] sudah ada.`);
        } else {
            payload.push({
                name: name,
                semesterId: semesterId,
            });
            addedNames.push(name);
            existingNames.add(name.toLowerCase()); 
        }
    });

    if (payload.length === 0) {
        let errMsg = isAI ? "❌ AI menghasilkan mata kuliah yang semuanya sudah ada." : "❌ Semua nama sudah terdaftar atau format salah.";
        if (errors.length > 0) errMsg += `\n\nGagal: ${errors.join('\n')}`;
        return sock.sendMessage(from, { text: errMsg });
    }

    // 2. Eksekusi Create Many
    const result = await db.prisma.subject.createMany({
        data: payload,
    });

    let successMsg = `✅ *${result.count} Mata Kuliah Baru Ditambahkan* ke Kelas ${className}.\n\n`;
    successMsg += `Daftar: ${addedNames.join(', ')}`;

    if (errors.length > 0) {
        successMsg += `\n\n⚠️ *Gagal Ditambahkan (${errors.length}):*\n${errors.join('\n')}`;
    }

    await sock.sendMessage(from, {
      text: successMsg,
      mentions: [sender]
    });
}


module.exports = {
  name: "#add-mapel",
  description: "Tambah mapel (Batch support). Format: #add-mapel [Nama 1 | Nama 2]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const namaMapelInput = text.replace("#add-mapel", "").trim();
    if (!namaMapelInput) {
        return bot.sock.sendMessage(from, { text: "⚠️ Masukkan nama mapel.\nContoh: `#add-mapel P. Agama | Etika Profesi`" });
    }

    try {
      // 1. Cek Kelas (FIX KRUSIAL: Tambahkan INCLUDE Semesters)
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
          include: { semesters: { where: { isActive: true } } } // <--- INCLUDE DITAMBAHKAN KEMBALI
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      
      const activeSem = kelas.semesters[0]; 
      
      // Safety check (Sekarang aman, karena jika kosong, activeSem adalah undefined, dan kondisi if akan menangkapnya)
      if (!activeSem) {
          return bot.sock.sendMessage(from, { text: "❌ Tidak ada Semester Aktif. Pastikan kelas sudah di-setup." });
      }
      
      const semesterId = activeSem.id;
      const className = kelas.name;


      // 2. Parsing Manual Batch (Input pipe/list atau single)
      const namesToProcess = namaMapelInput.split(/[\n|, |]/).map(n => n.trim()).filter(n => n.length > 0);
      
      return addSubjectsToDb(bot, from, sender, namesToProcess, semesterId, className, false);

    } catch (e) {
      console.error("Error add-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal tambah mapel." });
    }
  },
  // Export fungsi DB agar addAi.js bisa menggunakannya
  addSubjectsToDb: addSubjectsToDb 
};