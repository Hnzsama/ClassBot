module.exports = {
  name: "#hapus-task",
  description: "Menghapus tugas secara permanen",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, db } = bot;

    if (args.length === 0 || isNaN(args[0])) {
      await sock.sendMessage(from, {
        text: "Format salah. Gunakan: #hapus-task [nomor_tugas]",
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

    const deletedTaskName = tasks[index].judul;
    tasks.splice(index, 1);
    db.saveTasks(tasks);

    await sock.sendMessage(from, {
      text: `🗑️ Tugas *"${deletedTaskName}"* (nomor ${
        index + 1
      }) berhasil dihapus.`,
    });
  },
};