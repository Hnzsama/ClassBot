// prisma/seeds/seed.js
const { execSync } = require("child_process");
const path = require("path");

// HAPUS "master.js" dari sini. Urutannya sekarang:
const seeds = [
  "kelas.js",  // 1. Buat Kelas + Semester + Mapel (Master Data ada di sini sekarang)
  "member.js", // 2. Masukkan Member ke Kelas tersebut
];

console.log("🚀 Starting Database Seeding Process...\n");

try {
  for (const scriptName of seeds) {
    // Gunakan path.join(__dirname, scriptName) agar path akurat
    const scriptPath = path.join(__dirname, scriptName);
    
    console.log(`⏳ Running: ${scriptName}...`);
    execSync(`node "${scriptPath}"`, { stdio: "inherit" });
    console.log(`✅ Finished: ${scriptName}\n`);
  }
  console.log("✨ All seeds executed successfully!");
} catch (error) {
  console.error("\n❌ Seeding process failed.");
  process.exit(1);
}