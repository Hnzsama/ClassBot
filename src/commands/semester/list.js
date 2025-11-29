// src/commands/semester/list.js
module.exports = {
  name: "#list-semester",
  description: "Menampilkan daftar semester kelas ini.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Cari Kelas & Validasi (Dual Group Check)
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar. Gunakan `#add-class`." });

      // 2. Query Semesters
      const semesters = await bot.db.prisma.semester.findMany({
        where: { classId: kelas.id },
        include: {
          _count: { select: { subjects: true } } 
        },
        orderBy: { id: 'asc' }
      });

      if (semesters.length === 0) {
          return bot.sock.sendMessage(from, { 
              text: `📂 *DATA KOSONG*\n\nBelum ada semester untuk kelas *${kelas.name}*.\nGunakan command tambah semester untuk memulai.` 
          });
      }

      // 3. Format Output Estetik
      let text = `🎓 *RIWAYAT SEMESTER*\n`;
      text += `🏫 Kelas: ${kelas.name}\n`;
      text += `📊 Total: ${semesters.length} Semester\n`;
      text += `──────────────────────\n`;

      semesters.forEach((s) => {
        const isAktif = s.isActive;
        
        // Visual Logic
        // Hijau & Bold jika aktif, Putih/Abu jika tidak
        const icon = isAktif ? "🟢" : "⚪";
        const nameDisplay = isAktif ? `*${s.name}* (SEMESTER AKTIF)` : s.name;
        
        text += `${icon} ${nameDisplay}\n`;
        // Tampilkan ID (Monospace) dan Jumlah Mapel dalam satu baris rapi
        // Note: Backslash sebelum backtick digunakan agar karakter ` muncul di WA
        text += `   🆔 ID: \`${s.id}\`  •  📚 ${s._count.subjects} Mapel\n`;
        text += `\n`; // Spasi antar item
      });

      // 4. Footer Action (Konsisten dengan format koma)
      text += `──────────────────────\n`;
      text += `💡 *Ganti Semester Aktif:*\n`;
      text += `Ketik: \`#edit-semester [ID] status 1\`\n`; 
      text += `_(Contoh: #edit-semester 5 status 1)_`;

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error("Error list-semester:", e);
      await bot.sock.sendMessage(from, { text: "❌ Terjadi kesalahan database." });
    }
  }
};