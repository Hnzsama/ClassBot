// commands/semester/add.js
module.exports = {
  name: "#add-semester",
  description: "Menambah semester (Multiple support). Format: #add-semester [Nama Semester 1] | [Nama Semester 2]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    const rawContent = text.replace("#add-semester", "").trim();
    if (rawContent.length === 0) {
      return await bot.sock.sendMessage(from, { text: "⚠️ Format: `#add-semester Semester Genap | Semester Ganjil`" });
    }

    // Pisahkan input berdasarkan newline atau pipe (|)
    const rawNames = rawContent.split(/[\n|]/).map(name => name.trim()).filter(name => name.length > 0);

    try {
      // FIX: Gunakan Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan #add-class dulu." });

      // 2. Cek Duplikat di Database
      const existingSems = await bot.db.prisma.semester.findMany({
          where: { classId: kelas.id },
          select: { name: true }
      });
      const existingNames = new Set(existingSems.map(s => s.name.toLowerCase()));

      // ... (Logika Batch, Error, dan CreateMany tetap sama) ...
      const payload = [];
      const errors = [];
      const addedNames = [];

      rawNames.forEach(name => {
          if (existingNames.has(name.toLowerCase())) {
              errors.push(`[${name}] sudah ada.`);
          } else {
              payload.push({
                  name: name,
                  classId: kelas.id,
                  isActive: false,
              });
              addedNames.push(name);
              existingNames.add(name.toLowerCase()); 
          }
      });

      if (payload.length === 0) {
          return await bot.sock.sendMessage(from, { text: `❌ Gagal menambahkan semester. Semua nama sudah ada atau format salah.\n\nGagal: ${errors.join('\n')}` });
      }

      const result = await bot.db.prisma.semester.createMany({ data: payload, });

      let successMsg = `✅ *${result.count} Semester Baru Ditambahkan* ke Kelas ${kelas.name}.\n\n`;
      successMsg += `Nama Semester: ${addedNames.join(', ')}`;
      if (errors.length > 0) successMsg += `\n\n⚠️ *Gagal Ditambahkan (${errors.length}):*\n${errors.join('\n')}`;

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