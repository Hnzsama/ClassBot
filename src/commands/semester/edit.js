// src/commands/semester/edit.js
module.exports = {
  name: "#semester-edit",
  description: "Edit semester. Format: #semester-edit [ID] [New Name] or [ID] status 1",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Validasi Input (Spasi)
    if (args.length < 3) {
      return bot.sock.sendMessage(from, {
        text: "⚠️ *Format Salah (Gunakan Spasi)*\n\nContoh:\n`#edit-semester 1 status 1` (Aktifkan)\n`#edit-semester 1 nama Semester Pendek` (Ganti Nama)"
      });
    }

    const id = parseInt(args[0]);
    const field = args[1].toLowerCase();
    const value = args.slice(2).join(" ").trim();

    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "❌ ID Semester harus angka." });

    try {
      // 2. Cek Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 3. Cek Target Semester
      const targetSem = await bot.db.prisma.semester.findFirst({
        where: { id: id, classId: kelas.id }
      });

      if (!targetSem) return bot.sock.sendMessage(from, { text: `❌ Semester ID ${id} tidak ditemukan.` });

      // --- LOGIC UPDATE ---
      let reply = "";

      if (field === "status") {
        if (["1", "true", "aktif", "active"].includes(value.toLowerCase())) {

          // Transaction: Matikan semua -> Hidupkan target
          await bot.db.prisma.$transaction([
            bot.db.prisma.semester.updateMany({
              where: { classId: kelas.id },
              data: { isActive: false }
            }),
            bot.db.prisma.semester.update({
              where: { id },
              data: { isActive: true }
            })
          ]);

          reply = `🟢 *SEMESTER DIAKTIFKAN*\n`;
          reply += `──────────────────────\n`;
          reply += `🏫 Kelas: ${kelas.name}\n`;
          reply += `📅 Semester: *${targetSem.name}*\n`;
          reply += `🆔 ID: \`${targetSem.id}\`\n\n`;
          reply += `✅ Semester ini sekarang menjadi semester aktif.\n`;
          reply += `──────────────────────\n`;
          reply += `👤 Oleh: @${sender.split("@")[0]}`;

        } else {
          return bot.sock.sendMessage(from, { text: "⚠️ Hanya bisa mengaktifkan (set ke 1). Pilih semester lain jika ingin pindah." });
        }

      } else if (["name", "nama"].includes(field)) {
        if (value.length < 3) return bot.sock.sendMessage(from, { text: "⚠️ Nama semester terlalu pendek." });

        await bot.db.prisma.semester.update({
          where: { id },
          data: { name: value }
        });

        reply = `✨ *DATA SEMESTER DIPERBARUI*\n`;
        reply += `──────────────────────\n`;
        reply += `🏫 Kelas: ${kelas.name}\n\n`;
        reply += `🔄 *Rincian Perubahan:*\n`;
        reply += `   🆔 ID: \`${id}\`\n`;
        reply += `   🔻 Semula: ~${targetSem.name}~\n`;
        reply += `   ✅ Menjadi: *${value}*\n`;
        reply += `──────────────────────\n`;
        reply += `👤 Oleh: @${sender.split("@")[0]}`;

      } else {
        return bot.sock.sendMessage(from, { text: "❌ Opsi salah. Pilih: 'nama' atau 'status'." });
      }

      // Kirim Balasan
      await bot.sock.sendMessage(from, { text: reply, mentions: [sender] });

    } catch (e) {
      console.error("Error edit-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal edit semester." });
    }
  }
};