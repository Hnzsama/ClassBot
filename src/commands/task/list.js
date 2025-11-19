module.exports = {
  name: "#list-task",
  description: "Lihat daftar tugas. Format: #list-task [all/done/pending]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Filter Status
    let filterStatus = "Pending";
    let titleStatus = "⏳ PENDING";
    
    const arg = args[0] ? args[0].toLowerCase() : "";

    if (["done", "selesai", "kelar"].includes(arg)) {
        filterStatus = "Selesai";
        titleStatus = "✅ SELESAI";
    } else if (["all", "semua"].includes(arg)) {
        filterStatus = "ALL";
        titleStatus = "📂 SEMUA";
    }

    try {
      const kelas = await bot.db.prisma.class.findUnique({ where: { groupId: from } });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      const query = {
        where: { classId: kelas.id },
        orderBy: { deadline: 'asc' }
      };

      if (filterStatus !== "ALL") {
        query.where.status = filterStatus;
      }

      const tasks = await bot.db.prisma.task.findMany(query);

      if (tasks.length === 0) {
        return bot.sock.sendMessage(from, { text: `🎉 Tidak ada tugas dengan status: *${filterStatus}*` });
      }

      let text = `📋 *DAFTAR TUGAS KELAS*\n`;
      text += `🏫 Kelas: *${kelas.name}*\n`;
      text += `status: ${titleStatus} | Total: ${tasks.length}\n`;
      text += `──────────────────────\n`;

      // --- LOGIC TANGGAL DIPERBAIKI ---
      const now = new Date();
      // Reset jam 'sekarang' ke 00:00:00
      now.setHours(0, 0, 0, 0);
      
      tasks.forEach((t) => {
        const dateStr = t.deadline.toLocaleDateString("id-ID", { weekday: 'short', day: 'numeric', month: 'short' });
        
        // Ambil tanggal deadline dan reset jam ke 00:00:00
        const deadlineDate = new Date(t.deadline);
        deadlineDate.setHours(0, 0, 0, 0);

        // Hitung selisih hari murni
        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let alert = "";
        let icon = "📌"; // Default

        if (t.status === "Pending") {
            if (diffDays < 0) { 
                alert = "⚠️ *TERLEWAT*"; 
                icon = "🚨"; 
            } 
            else if (diffDays === 0) { // Pas Hari Ini
                alert = "🔥 *HARI INI!*"; 
                icon = "💥"; 
            } 
            else if (diffDays === 1) { // Besok
                alert = "⚡ *BESOK*"; 
                icon = "🔥"; 
            }
            else if (diffDays <= 3) { 
                alert = "⚠️ *Hampir*"; 
            }
        } else {
            icon = "✅";
        }

        const linkDisplay = (t.link && t.link !== "-" && t.link.length > 1) 
            ? `│ 🔗 ${t.link}\n` 
            : "";

        text += `╭── ${icon} *${t.mapel}*\n`;
        text += `│ 📝 ${t.judul}\n`;
        text += `│ 📅 ${dateStr} ${alert}\n`;
        text += linkDisplay;
        text += `╰ 🆔 ID: *${t.id}* | Status: _${t.status}_\n\n`;
      });

      text += `💡 *Quick Action:*\n`;
      text += `• Selesai: \`#task-status [ID] done\`\n`;
      text += `• Hapus: \`#delete-task [ID]\``;

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Error database." });
    }
  }
};