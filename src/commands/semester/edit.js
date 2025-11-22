// commands/semester/edit.js
module.exports = {
  name: "#edit-semester",
  description: "Edit semester. Format: #edit-semester [ID] [name/status] [Value]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return; // Command hanya untuk grup

    // Validasi jumlah argumen
    if (args.length < 3) {
        return bot.sock.sendMessage(from, { text: "⚠️ Format Salah!\nContoh:\n`#edit-semester 1 status 1`\n`#edit-semester 1 name Semester Baru`" });
    }

    const id = parseInt(args[0]);
    const field = args[1].toLowerCase();
    const value = args.slice(2).join(" ").trim();

    if (isNaN(id)) {
        return bot.sock.sendMessage(from, { text: "❌ ID Semester harus angka." });
    }

    try {
      // 1. Cek Kelas (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });
      const classId = kelas.id;
      
      // 2. Cek apakah Semester target milik Kelas ini
      const targetSem = await bot.db.prisma.semester.findFirst({
        where: { id: id, classId: classId }
      });

      if (!targetSem) {
          return bot.sock.sendMessage(from, { text: `❌ Semester ID ${id} tidak ditemukan di kelas ini.` });
      }

      // --- LOGIC UPDATE ---

      if (field === "status") {
        if (value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "aktif") {
          
          // Transaction: Matikan semua di kelas ini -> Hidupkan target
          await bot.db.prisma.$transaction([
            bot.db.prisma.semester.updateMany({ 
              where: { classId: classId }, 
              data: { isActive: false } 
            }), 
            bot.db.prisma.semester.update({ 
              where: { id }, 
              data: { isActive: true } 
            })
          ]);
          return bot.sock.sendMessage(from, { text: `✅ Semester ID ${id} (*${targetSem.name}*) sekarang *AKTIF*.` });
        } else {
          return bot.sock.sendMessage(from, { text: "⚠️ Hanya bisa set status ke aktif (1). Gunakan semester lain untuk menonaktifkan ini." });
        }
      
      } else if (field === "name" || field === "nama") { // Support 'name' atau 'nama'
        if (value.length < 3) {
             return bot.sock.sendMessage(from, { text: "⚠️ Nama semester terlalu pendek." });
        }

        await bot.db.prisma.semester.update({ 
            where: { id }, 
            data: { name: value } 
        });
        
        return bot.sock.sendMessage(from, { text: `✅ Nama semester ID ${id} diubah menjadi *${value}*.` });

      } else {
        // Jika field salah
        return bot.sock.sendMessage(from, { text: "❌ Opsi salah. Gunakan: 'name' (ubah nama) atau 'status' (aktifkan)." });
      }

    } catch (e) {
      console.error("Error edit-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal edit semester." });
    }
  }
};