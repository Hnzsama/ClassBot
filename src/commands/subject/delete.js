// src/commands/mapel/delete.js
module.exports = {
  name: "#delete-mapel",
  description: "Hapus mapel. Format: #delete-mapel [ID Mapel 1] [ID 2]... (--force)",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Parse Multiple DB IDs
    const isForce = text.includes("--force");
    const dbIds = args.filter(arg => !isNaN(parseInt(arg))).map(id => parseInt(id)); 
    
    if (dbIds.length === 0) {
        return bot.sock.sendMessage(from, { text: "⚠️ Masukkan setidaknya satu ID Mapel yang valid (Angka DB). Contoh: `#delete-mapel 487 490`" });
    }

    try {
      // 2. Cari Kelas & Ambil Semua Semester ID-nya
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
        include: { semesters: { select: { id: true } } } // Ambil hanya ID semesternya
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas tidak ditemukan." });
      
      // Array berisi ID semester milik kelas ini
      const validSemesterIds = kelas.semesters.map(s => s.id);

      if (validSemesterIds.length === 0) {
          return bot.sock.sendMessage(from, { text: "❌ Kelas ini belum memiliki semester." });
      }

      // 3. Ambil subjects berdasarkan ID DB dan Valid Semester IDs (Security Check)
      const subjectsToDelete = await bot.db.prisma.subject.findMany({ 
          where: { 
              id: { in: dbIds }, 
              semesterId: { in: validSemesterIds } // Filter: Hanya subject yang ada di semester milik kelas ini
          },
          select: { id: true, name: true } 
      });
      
      if (subjectsToDelete.length === 0) {
           return bot.sock.sendMessage(from, { text: `❌ Tidak ditemukan mapel dengan ID: ${dbIds.join(', ')} di kelas ini.` });
      }

      let report = { deleted: 0, failedTasks: 0, blocked: [] };
      const finalIdsToDelete = [];
      const classId = kelas.id;

      // 4. Sequential Deletion and Validation
      for (const target of subjectsToDelete) {
          // A. Safety Check (Count related tasks)
          // Task terhubung langsung ke Class, jadi kita cek by ClassID & Nama Mapel
          const relatedTasks = await bot.db.prisma.task.count({
            where: {
              classId: classId,
              mapel: target.name 
            }
          });
          
          // B. Enforce Force Flag
          if (relatedTasks > 0 && !isForce) {
              report.blocked.push(`ID ${target.id} (${target.name}) — ${relatedTasks} tugas terkait`);
              report.failedTasks++;
              continue;
          }

          // C. Collect ID for Deletion
          finalIdsToDelete.push(target.id);
      }

      // 5. Eksekusi Delete Massal di Database
      if (finalIdsToDelete.length > 0) {
          const result = await bot.db.prisma.subject.deleteMany({ 
              where: { id: { in: finalIdsToDelete } } 
          });
          report.deleted = result.count;
      }

      // 6. Kirim Info & Report Summary
      let reply = `🗑️ *PENGHAPUSAN BERHASIL* 🗑️\n\n`;
      reply += `✅ *Total Dihapus:* ${report.deleted} mapel.\n`;

      if (report.failedTasks > 0) {
          reply += `\n⛔ *DIBLOKIR (${report.failedTasks}):* \n`;
          reply += report.blocked.join('\n');
          reply += `\n\n_Ulangi dengan flag \`--force\` jika Anda ingin menghapus yang terblokir._`;
      } else if (report.blocked.length > 0) {
          reply += `\n⚠️ *Peringatan:* Beberapa ID tidak ditemukan (${report.blocked.length} invalid).`;
      }
      
      await bot.sock.sendMessage(from, { text: reply });

    } catch (e) {
      console.error("Error multi-delete mapel:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal menghapus mapel secara massal." });
    }
  }
};