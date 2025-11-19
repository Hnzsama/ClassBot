module.exports = {
  name: "#edit-semester",
  description: "Edit semester. Format: #edit-semester [ID] [name/status] [Value]",
  execute: async (bot, from, sender, args, msg) => {
    if (args.length < 3) return bot.sock.sendMessage(from, { text: "⚠️ Contoh: `#edit-semester 1 status 1` atau `#edit-semester 1 name Genap 2025`" });

    const id = parseInt(args[0]);
    const field = args[1].toLowerCase();
    const value = args.slice(2).join(" ");

    try {
      if (field === "status") {
        // Logic khusus: Jika mengaktifkan satu, matikan yang lain
        if (value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "aktif") {
          await bot.db.prisma.$transaction([
            bot.db.prisma.semester.updateMany({ data: { isActive: false } }), // Matikan semua
            bot.db.prisma.semester.update({ where: { id }, data: { isActive: true } }) // Hidupkan target
          ]);
          return bot.sock.sendMessage(from, { text: `✅ Semester ID ${id} sekarang *AKTIF*.` });
        } else {
          return bot.sock.sendMessage(from, { text: "⚠️ Hanya bisa set status ke aktif (1). Gunakan semester lain untuk menonaktifkan ini." });
        }
      } 
      
      if (field === "name") {
        await bot.db.prisma.semester.update({ where: { id }, data: { name: value } });
        return bot.sock.sendMessage(from, { text: `✅ Nama semester ID ${id} diubah.` });
      }

      await bot.sock.sendMessage(from, { text: "❌ Opsi salah. Hanya 'name' atau 'status'." });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal edit (ID tidak ditemukan)." });
    }
  }
};