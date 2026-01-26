// src/commands/tugas/list.js
module.exports = {
  name: "#task-list",
  description: "Show task list (Pending/All).",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    // 1. Filter Status
    let filterStatus = "Pending";
    let titleStatus = "⏳ PENDING";

    const arg = args[0] ? args[0].toLowerCase() : "";

    if (["done", "selesai", "kelar"].includes(arg)) {
      filterStatus = "Selesai";
      titleStatus = "✅ SELESAI";
    } else if (["terlewat", "expired", "lewat"].includes(arg)) {
      filterStatus = "Terlewat";
      titleStatus = "⛔ TERLEWAT";
    } else if (["all", "semua"].includes(arg)) {
      filterStatus = "ALL";
      titleStatus = "📂 SEMUA";
    }

    try {
      // 2. FIX: Dual Group Check
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 3. Query Database
      const query = {
        where: { classId: kelas.id },
        orderBy: { deadline: 'asc' }
      };

      if (filterStatus !== "ALL") {
        query.where.status = filterStatus;
      }

      const tasks = await bot.db.prisma.task.findMany({
        ...query,
        select: {
          id: true, mapel: true, judul: true, deadline: true, link: true, status: true, isGroupTask: true, attachmentData: true
        }
      });

      if (tasks.length === 0) {
        return bot.sock.sendMessage(from, { text: `🎉 Tidak ada tugas dengan status: *${filterStatus}*` });
      }

      // 4. Susun Tampilan (Box Style Preserved)
      let text = `📋 *DAFTAR TUGAS KELAS*\n`;
      text += `🏫 Kelas: *${kelas.name}*\n`;
      text += `status: ${titleStatus} | Total: ${tasks.length}\n`;
      text += `──────────────────────\n`;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      tasks.forEach((t) => {
        const dateTimeStr = t.deadline.toLocaleString("id-ID", { dateStyle: 'short', timeStyle: 'short' });

        const deadlineDate = new Date(t.deadline);
        deadlineDate.setHours(0, 0, 0, 0);

        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let alert = "";
        let icon = "📌";

        if (t.status === "Pending" || t.status === "Terlewat") {
          if (diffDays < 0) { alert = "⚠️ *TERLEWAT*"; icon = "🚨"; }
          else if (diffDays === 0) { alert = "🔥 *HARI INI!*"; icon = "💥"; }
          else if (diffDays === 1) { alert = "⚡ *BESOK*"; icon = "🔥"; }
          else if (diffDays <= 3) { alert = "⚠️ *Hampir*"; }
        } else {
          icon = "✅";
        }

        const attachmentIcon = t.attachmentData ? ' 📎' : '';
        const typeIcon = t.isGroupTask ? '👥' : '👤';

        // --- LOGIC LINK ---
        // Jika ada link dan bukan "-", tampilkan baris link
        const linkDisplay = (t.link && t.link !== "-" && t.link.length > 1)
          ? `│ 🔗 ${t.link}\n`
          : "";

        // FORMAT TAMPILAN
        text += `╭── ${icon} *${t.mapel}* (${typeIcon})${attachmentIcon}\n`;
        text += `│ 📝 ${t.judul}\n`;
        text += `│ 📅 ${dateTimeStr} ${alert}\n`;
        text += linkDisplay; // <--- Link Masuk Sini
        text += `╰ 🆔 ID: *${t.id}* | Status: _${t.status}_\n\n`;
      });

      // 5. Quick Action Updated
      text += `💡 *Aksi Cepat:*\n`;
      text += `• Detail: \`#task-detail [ID]\`\n`;
      text += `• Selesai: \`#task-status [ID] done\`\n`;
      text += `• Edit: \`#task-edit [ID] judul [Baru]\`\n`;
      text += `• Hapus: \`#task-del [ID]\`\n`;
      text += `• Otomatis: \`#task-ai Hapus tugas ID 15\``;

      await bot.sock.sendMessage(from, { text });

    } catch (e) {
      console.error(e);
      await bot.sock.sendMessage(from, { text: "❌ Error database." });
    }
  }
};