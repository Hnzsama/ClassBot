// prisma/seeds/member.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Data Konstan (Hanya butuh Group ID untuk mencari relasi)
const GROUP_ID = "120363421309923905@g.us";

const membersData = [
  { nim: "25091397003", nama: "MUHAMMAD MAULANA ADRIANSYAH", panggilan: "Maulana" },
  { nim: "25091397015", nama: "MUHAMMAD SATRIYO FAJAR PANGESTU", panggilan: "Satriyo" },
  { nim: "25091397023", nama: "RIFDAH SAKHI RAMADHANI", panggilan: "Rifdah" },
  { nim: "25091397035", nama: "SAYYIDAH FARAH AMELLIA", panggilan: "Farah" },
  { nim: "25091397037", nama: "HILBRAM IQBAL HAMIDY", panggilan: "Hilbram" },
  { nim: "25091397042", nama: "WIBOWO AJI SETIAJI NOVIANSYAH", panggilan: "Wibowo" },
  { nim: "25091397045", nama: "PILEYO HANANIM ZAMONOKHI BATE'E", panggilan: "Pileyo" },
  { nim: "25091397051", nama: "ZULFA DUROTUN NAFISYAH", panggilan: "Zulfa" },
  { nim: "25091397059", nama: "SYAIFUL ANAM", panggilan: "Syaiful" },
  { nim: "25091397069", nama: "ADAM SAFINAS", panggilan: "Adam" },
  { nim: "25091397076", nama: "SORAYA IKHSANIA BALQIS", panggilan: "Soraya" },
  { nim: "25091397077", nama: "RAFA RIZQULLAH NUR MUHAMMAD", panggilan: "Rafa" },
  { nim: "25091397082", nama: "ELVIRA APRILIA", panggilan: "Elvira" },
  { nim: "25091397084", nama: "DAFA ABIYYU RAHYUDI", panggilan: "Dafa" },
  { nim: "25091397086", nama: "LUQMAN BIL AS'HAR", panggilan: "Luqman" },
  { nim: "25091397089", nama: "MUHAMMAD CAESARY WALY AVERROES", panggilan: "Caesary" },
  { nim: "25091397093", nama: "CHRISTIANO LAURENCIUS GEOVANN GUNAWAN", panggilan: "Christiano" },
  { nim: "25091397095", nama: "DILLA ANGELINA DAMIRI", panggilan: "Dilla" },
  { nim: "25091397097", nama: "ALYA NURIN FADILAH", panggilan: "Alya" },
  { nim: "25091397098", nama: "ELLA DEA AZAHRA", panggilan: "Ella" },
  { nim: "25091397103", nama: "AULIA RESWARI PUTRI ARIF", panggilan: "Aulia" },
  { nim: "25091397105", nama: "TEGAR SATRIA WICAKSONO", panggilan: "Tegar" },
  { nim: "25091397108", nama: "AISYAH CURRENTS", panggilan: "Aisyah" },
  { nim: "25091397111", nama: "RAFAEL MAULANA", panggilan: "Rafael" },
  { nim: "25091397115", nama: "ALIF DAFFA FADILAH", panggilan: "Alif" },
  { nim: "25091397124", nama: "NARENDRA DANISWARA", panggilan: "Narendra" },
  { nim: "25091397129", nama: "ANDRASENA NUGRAHA", panggilan: "Andrasena" },
  { nim: "25091397130", nama: "JIHAD FISABILILLAH", panggilan: "Jihad" },
  { nim: "25091397132", nama: "FLO RARAS FATHIN", panggilan: "Flo" },
  { nim: "25091397147", nama: "MOCHAMMAD BAGUS SETIO PRAKOSO", panggilan: "Bagus" },
];

async function main() {
  console.log(`🚀 Mencari data kelas untuk Group ID: ${GROUP_ID}...`);

  // 1. Cari Kelas ID berdasarkan Group WA
  const targetKelas = await prisma.class.findUnique({
    where: { groupId: GROUP_ID },
  });

  if (!targetKelas) {
    throw new Error(
      "❌ Kelas tidak ditemukan! Jalankan seed 'kelas.js' terlebih dahulu."
    );
  }

  console.log(`✅ Ditemukan Kelas: ${targetKelas.name} (ID: ${targetKelas.id})`);

  // 2. Mapping data (Tambahkan classId)
  const finalData = membersData.map((m) => ({
    ...m,
    classId: targetKelas.id, // Link member ke ID Kelas
  }));

  // 3. Bersihkan Member Lama
  await prisma.member.deleteMany({
    where: { classId: targetKelas.id },
  });
  console.log("🗑️ Member lama di kelas ini dibersihkan.");

  // 4. Masukkan Data Baru
  const result = await prisma.member.createMany({
    data: finalData,
  });

  console.log(`✅ Berhasil memasukkan ${result.count} siswa ke kelas ${targetKelas.name}.`);
}

main()
  .catch((e) => {
    console.error("❌ Terjadi kesalahan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });