// commands/semester/add.js
module.exports = {
  name: "#add-semester",
  description: "Menambah semester. Format: #add-semester [Nama 1], [Nama 2]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Parsing Input
    const rawContent = text.replace("#add-semester", "").trim();
    
    if (rawContent.length === 0) {
      return await bot.sock.sendMessage(from, { 
          text: "⚠️ *Format Tambah Semester*\n\nGunakan koma ( , ) untuk menambah banyak sekaligus.\n\nContoh:\n`#add-semester Semester 1, Semester 2`\n\nAtau:\n`#add-semester Ganjil 2024, Genap 2025`" 
      });
    }

    // Pisahkan berdasarkan Koma (,) ATAU Baris Baru (\n)
    // Regex /[,\n]+/ artinya: pisah kalau ketemu koma atau enter
    const rawNames = rawContent.split(/[,\n]+/).map(name => name.trim()).filter(name => name.length > 0);

    if (rawNames.length === 0) {
        return await bot.sock.sendMessage(from, { text: "⚠️ Tidak ada nama semester yang terbaca." });
    }

    try {
      // 2. Cek Validasi Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan `#add-class` dulu." });

      // 3. Cek Duplikat (Ambil data lama untuk dibandingkan)
      const existingSems = await bot.db.prisma.semester.findMany({
          where: { classId: kelas.id },
          select: { name: true }
      });
      // Simpan nama lama dalam lowercase set agar pencarian cepat
      const existingNames = new Set(existingSems.map(s => s.name.toLowerCase()));

      // 4. Filter Data Baru
      const payload = [];
      const errors = [];
      const addedNames = []; // Untuk laporan sukses

      rawNames.forEach(name => {
          if (existingNames.has(name.toLowerCase())) {
              errors.push(`- ${name} (Sudah ada)`);
          } else {
              payload.push({
                  name: name,
                  classId: kelas.id,
                  isActive: false, // Default tidak aktif
              });
              addedNames.push(name);
              existingNames.add(name.toLowerCase()); // Masukkan ke set lokal biar gak duplikat sesama input
          }
      });

      if (payload.length === 0) {
          return await bot.sock.sendMessage(from, { 
              text: `❌ Semua semester gagal ditambahkan (Duplikat).\n\n${errors.join('\n')}` 
          });
      }

      // 5. Eksekusi Simpan
      const result = await bot.db.prisma.semester.createMany({ data: payload });

      // 6. Respon Sukses
      let successMsg = `✅ *SEMESTER BERHASIL DITAMBAHKAN*\n`;
      successMsg += `🏫 Kelas: ${kelas.name}\n`;
      successMsg += `📊 Jumlah: ${result.count} baru\n`;
      successMsg += `────────────────\n`;
      successMsg += `➕ ${addedNames.join(', ')}\n`;

      if (errors.length > 0) {
          successMsg += `\n⚠️ *Dilewati (${errors.length}):*\n${errors.join('\n')}`;
      }
      
      successMsg += `\n💡 _Gunakan #set-semester [ID] untuk mengaktifkan semester._`;

      await bot.sock.sendMessage(from, {
        text: successMsg,
        mentions: [sender]
      });

    } catch (e) {
      console.error("Error add-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal tambah semester." });
    }
  },
};