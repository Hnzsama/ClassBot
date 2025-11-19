// prisma/seeds/kelas.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// --- KONFIGURASI ---
const GROUP_ID = "120363421309923905@g.us"; 
const NAMA_KELAS = "Inter 2025I";

// Data Mapel Semester 1 (Sesuai Gambar)
const mapelSem1 = [
  { name: "Algoritma dan Pemrograman" },
  { name: "Matematika Komputasi" },
  { name: "Jaringan Komputer" },
  { name: "Literasi Digital" },
  { name: "Pengantar Manajemen Proses Bisnis" },
  { name: "Kewirausahaan" },
  { name: "Agama Islam" }
];

async function main() {
  console.log(`🏫 Seeding Kelas: ${NAMA_KELAS}...`);

  // 1. Reset Data Kelas ini (Hapus dulu biar bersih)
  const exist = await prisma.class.findUnique({ where: { groupId: GROUP_ID } });
  if (exist) {
    await prisma.class.delete({ where: { groupId: GROUP_ID } });
    console.log("🗑️ Data kelas lama dihapus.");
  }

  // 2. Buat Kelas + Semester + Mapel
  const kelas = await prisma.class.create({
    data: {
      groupId: GROUP_ID,
      name: NAMA_KELAS,
      description: "Kelas Algoritma & Pemrograman",
      semesters: {
        create: [
          {
            name: "Semester 1",
            isActive: true, // Semester ini AKTIF
            subjects: {
              create: mapelSem1 // Masukkan mapel di atas
            }
          },
          {
            name: "Semester 2",
            isActive: false // Belum aktif
          }
        ]
      }
    },
    include: {
      semesters: { include: { subjects: true } }
    }
  });

  console.log(`✅ Kelas Terdaftar: ${kelas.name}`);
  const s1 = kelas.semesters.find(s => s.name === "Semester 1");
  console.log(`📅 ${s1.name} Aktif dengan ${s1.subjects.length} Mata Kuliah.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });