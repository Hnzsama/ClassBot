module.exports = {
  name: "#list-task",
  description: "Menampilkan daftar tugas",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;
    const tasks = db.loadTasks();

    // 1. Logika untuk #list-task [filter]
    if (args.length > 0) {
      const statusFilter = args[0].toLowerCase();
      if (statusFilter !== "selesai" && statusFilter !== "pending") {
        await sock.sendMessage(from, {
          text: "Status tidak valid. Gunakan: #list-task selesai atau #list-task pending",
        });
        return;
      }

      const statusToFilter =
        statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
      const filteredTasks = tasks.filter((t) => t.status === statusToFilter);

      if (filteredTasks.length === 0) {
        await sock.sendMessage(from, {
          text: `✨ Tidak ada tugas dengan status "${statusToFilter}".`,
        });
        return;
      }

      let teks = `*LIST TUGAS - ${statusToFilter.toUpperCase()}* (${
        filteredTasks.length
      } TUGAS)\n\n`;
      const listTugas = filteredTasks
        .map((t) => {
          const originalIndex =
            tasks.findIndex((originalTask) => originalTask.id === t.id) + 1;
          const statusIcon = t.status === "Selesai" ? "✅" : "⏳";
          const lineThrough = t.status === "Selesai" ? "~" : "";

          return (
            `${lineThrough}*${originalIndex}. ${t.judul.toUpperCase()}*${lineThrough}\n` +
            `${statusIcon} *Status:* ${t.status}\n` +
            `📚 *Mapel:* ${t.mapel}\n` +
            `🗓️ *Deadline:* ${t.deadline}\n` +
            `🔗 *Link:* \`\`\`${t.link}\`\`\``
          );
        })
        .join("\n\n─────────────────\n\n");

      await sock.sendMessage(from, { text: teks + listTugas });
      return;
    }

    // 2. Logika untuk #list-task (Semua)
    if (tasks.length === 0) {
      await sock.sendMessage(from, {
        text: "✨ Belum ada tugas tersimpan.",
      });
      return;
    }

    let teks = `*LIST TUGAS SAAT INI (${tasks.length} TUGAS)*\n\n`;
    const listTugas = tasks
      .map((t, i) => {
        const statusIcon = t.status === "Selesai" ? "✅" : "⏳";
        const lineThrough = t.status === "Selesai" ? "~" : "";

        return (
          `${lineThrough}*${i + 1}. ${t.judul.toUpperCase()}*${lineThrough}\n` +
          `${statusIcon} *Status:* ${t.status}\n` +
          `📚 *Mapel:* ${t.mapel}\n` +
          `🗓️ *Deadline:* ${t.deadline}\n`
        );
      })
      .join("\n\n─────────────────\n\n");

    await sock.sendMessage(from, { text: teks + listTugas });
  },
};