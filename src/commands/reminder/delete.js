// src/commands/reminder/delete.js
module.exports = {
  name: "#delete-reminder",
  description: "Hapus pengingat (Khusus Admin). Format: #delete-reminder [ID]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;
    
    const id = parseInt(args[0]);
    if (isNaN(id)) return bot.sock.sendMessage(from, { text: "⚠️ Masukkan ID angka. Contoh: #delete-reminder 12" });

    try {
      // --- 1. CEK STATUS ADMIN (BARU) ---
      // Ambil data member grup
      const metadata = await bot.sock.groupMetadata(from);
      // Cari data si pengirim command
      const participant = metadata.participants.find(p => p.id === sender);
      
      // Cek apakah dia admin/superadmin
      const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

      if (!isAdmin) {
        return bot.sock.sendMessage(from, { text: "❌ Akses Ditolak. Fitur hapus hanya untuk Admin Grup." });
      }
      // ----------------------------------

      // 2. Cari Kelas (Dual Check)
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 3. Cek Kepemilikan Reminder
      const reminder = await bot.db.prisma.reminder.findFirst({
        where: { id: id, classId: kelas.id } // Filter by Class ID
      });

      if (!reminder) return bot.sock.sendMessage(from, { text: "❌ Reminder tidak ditemukan di kelas ini." });

      // 4. Hapus
      await bot.db.prisma.reminder.delete({ where: { id } });
      await bot.sock.sendMessage(from, { text: `✅ Pengingat ID *${id}* ("${reminder.pesan}") berhasil dihapus.` });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal hapus reminder. Pastikan bot adalah Admin agar bisa cek metadata." });
    }
  }
};