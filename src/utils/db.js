const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. AMBIL SEMUA TUGAS (Read)
async function getTasks() {
  try {
    return await prisma.task.findMany();
  } catch (error) {
    console.error("Gagal mengambil tasks:", error);
    return [];
  }
}

// 2. TAMBAH TUGAS BARU (Create)
async function addTask(data) {
  try {
    return await prisma.task.create({
      data: {
        groupId: data.groupId,
        mapel: data.mapel,
        judul: data.judul,
        deadline: new Date(data.deadline), // Pastikan format tanggal valid
        link: data.link,
        status: "Pending",
        reminderSent: false
      }
    });
  } catch (error) {
    console.error("Gagal menambah task:", error);
    throw error;
  }
}

// 3. UPDATE STATUS REMINDER (Update)
// Ini pengganti saveTasks() untuk kasus update reminder
async function updateTaskReminder(id, status) {
  try {
    return await prisma.task.update({
      where: { id: id },
      data: { reminderSent: status },
    });
  } catch (error) {
    console.error(`Gagal update reminder task ${id}:`, error);
  }
}

// 4. HAPUS TUGAS (Delete)
async function deleteTask(id) {
  try {
    return await prisma.task.delete({
      where: { id: id },
    });
  } catch (error) {
    console.error(`Gagal menghapus task ${id}:`, error);
  }
}

module.exports = {
  prisma,
  getTasks,
  addTask,
  updateTaskReminder,
  deleteTask
};