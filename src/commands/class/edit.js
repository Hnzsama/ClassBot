// src/commands/kelas/edit-class.js
module.exports = {
  name: "#edit-class",
  description: "Ubah info kelas. Format: #edit-class [Field], [Value]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // Cek Eksistensi Kelas
    const existingClass = await bot.db.prisma.class.findFirst({
      where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
    });

    if (!existingClass) return bot.sock.sendMessage(from, { text: "❌ Grup ini belum terdaftar sebagai kelas." });

    // Parsing Input (Menggunakan Koma)
    const rawContent = text.replace("#edit-class", "").trim();
    const parts = rawContent.split(",").map(p => p.trim());

    if (parts.length < 2) {
        return bot.sock.sendMessage(from, { 
            text: `⚠️ *Format Edit Kelas*\n\nContoh:\n\`#edit-class nama, Sistem Informasi B\`\n\`#edit-class deskripsi, Grup Resmi Angkatan 24\`` 
        });
    }

    const field = parts[0].toLowerCase();
    const newValue = parts.slice(1).join(",").trim();

    let updateData = {};
    let displayField = "";
    let oldValue = "";

    // Tentukan Field & Simpan Nilai Lama (Untuk Perbandingan)
    if (["nama", "name"].includes(field)) {
        updateData.name = newValue;
        displayField = "🏷️ NAMA KELAS";
        oldValue = existingClass.name;
    } else if (["deskripsi", "desc", "description"].includes(field)) {
        updateData.description = newValue;
        displayField = "📝 DESKRIPSI";
        oldValue = existingClass.description || "(Kosong)";
    } else {
        return bot.sock.sendMessage(from, { text: "❌ Field salah. Pilih: 'nama' atau 'deskripsi'." });
    }

    try {
        // Update Database
        await bot.db.prisma.class.update({
            where: { id: existingClass.id },
            data: updateData
        });

        // Respon
        let reply = `✨ *CLASS DATA UPDATED* ✨\n`;
        reply += `──────────────────────\n`;
        reply += `🏫 Kelas: *${updateData.name || existingClass.name}*\n\n`;
        
        reply += `🔄 *Rincian Perubahan:*\n`;
        reply += `📂 Bagian: ${displayField}\n`;
        reply += `🔻 Semula: _${oldValue}_\n`;
        reply += `✅ Menjadi: *${newValue}*\n`;
        
        reply += `──────────────────────\n`;
        reply += `👤 _Diupdate oleh: @${sender.split("@")[0]}_`;

        await bot.sock.sendMessage(from, { 
            text: reply,
            mentions: [sender]
        });

    } catch (e) {
        console.error("Error edit-class:", e);
        await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan saat mengupdate data." });
    }
  }
};