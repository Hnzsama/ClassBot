module.exports = {
  name: "#selesai",
  description: "Menandai tugas sebagai selesai",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;

    if (args.length === 0 || isNaN(args[0])) {
      await sock.sendMessage(from, {
        text: "Format salah. Gunakan: #selesai [nomor_tugas]",
      });
      return;
    }

    const index = parseInt(args[0]) - 1;
    let tasks = db.loadTasks();

    if (index < 0 || index >= tasks.length) {
      await sock.sendMessage(from, {
        text: `Tugas nomor ${index + 1} tidak ditemukan.`,
      });
      return;
    }

    tasks[index].status = "Selesai";
    db.saveTasks(tasks);

    await sock.sendMessage(from, {
      text: `✅ Mantap! Tugas *"${tasks[index].judul}"* ditandai selesai.`,
    });
  },
};