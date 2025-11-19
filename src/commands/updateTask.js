module.exports = {
  name: "#update-task",
  description: "Memperbarui detail tugas",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;

    if (args.length < 3) {
      await sock.sendMessage(from, {
        text: "Format salah. Gunakan:\n*#update-task [nomor] [field] [nilai_baru]*\n\nContoh:\n`#update-task 2 deadline 2025-12-01`\n\nField yg valid: `mapel`, `judul`, `deadline`, `link`",
      });
      return;
    }

    const index = parseInt(args[0]) - 1;
    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");

    const validFields = ["mapel", "judul", "deadline", "link"];
    if (!validFields.includes(field)) {
      await sock.sendMessage(from, {
        text: `Field '${field}' tidak valid. Field yg valid: mapel, judul, deadline, link`,
      });
      return;
    }

    let tasks = db.loadTasks();
    if (index < 0 || index >= tasks.length) {
      await sock.sendMessage(from, {
        text: `Tugas nomor ${index + 1} tidak ditemukan.`,
      });
      return;
    }

    const oldValue = tasks[index][field];

    tasks[index][field] = newValue;
    db.saveTasks(tasks);

    await sock.sendMessage(from, {
      text:
        `✅ Tugas *${index + 1}* berhasil diupdate:\n\n` +
        `*Field:* ${field}\n` +
        `*Lama:* ${oldValue}\n` +
        `*Baru:* ${newValue}`,
    });
  },
};