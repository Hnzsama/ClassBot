// src/commands/general/help.js
module.exports = {
  name: "#help",
  description: "Pusat bantuan bot. Format: #help [kategori]",
  execute: async (bot, from, sender, args, msg) => {
    const { sock } = bot;
    const pushName = msg.pushName || sender.split("@")[0];
    
    const category = args[0] ? args[0].toLowerCase() : "";

    // ============================================================
    // 1. SUB-MENU: SETUP (PANDUAN AWAL)
    // ============================================================
    if (category === "setup" || category === "panduan" || category === "onboarding") {
      const text = `⚙️ *PANDUAN AKTIVASI KELAS BARU*
Prosedur langkah demi langkah untuk Admin:

*TAHAP 1: BUAT KELAS (Di Grup Utama/Output)*
1. Ketik: \`#add-class [Nama Kelas] | [Deskripsi]\`
   _(Bot akan membuat Kelas & Semester 1 otomatis)_
2. Catat *Class ID* dan *Main Group ID* yang muncul.

*TAHAP 2: HUBUNGKAN KOMUNITAS (Di Grup Input)*
Jika Anda ingin memisahkan grup chat (diskusi) dengan grup info:
1. Pergi ke grup diskusi/komunitas.
2. Ketik: \`#assign-class [Class ID] [Main Group ID]\`

*TAHAP 3: KURIKULUM & MEMBER*
1. Buat semester lanjutan: \`#add-semester-ai 8\`
2. Tambah mapel (AI): \`#add-mapel-ai [List Mapel/Silabus]\`
3. *Saran Member:* Minta mahasiswa input data sendiri via:
   \`#add-member [NIM] | [Nama] | [Panggilan]\`

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 2. SUB-MENU: COMMUNITY (DUAL GROUP)
    // ============================================================
    if (category === "community" || category === "komunitas") {
      const text = `🌐 *BANTUAN: COMMUNITY GROUP*
Sistem untuk memisahkan *Grup Info* (Output) dan *Grup Chat* (Input).

*KONSEP:*
- *Grup Utama (Output):* Tempat Bot mengirim Reminder & Jadwal. (Biasanya "Only Admin").
- *Grup Komunitas (Input):* Tempat Member mengetik command bot (#add-task, tanya jawab, dll).

*PERINTAH:*
├ \`#add-class [Nama] | [Deskripsi]\`
│ (Jalankan di Grup Utama untuk mendaftar).
│
╰ \`#assign-class [Class ID] [Main Group ID]\`
  (Jalankan di Grup Komunitas untuk menautkan).

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 3. SUB-MENU: KELAS
    // ============================================================
    if (category === "kelas") {
      const text = `🏫 *BANTUAN: MANAJEMEN KELAS*

╭── [ *Perintah Kelas* ]
│
├ \`#info-class\`
│ Cek status kelas, ID Grup (Main/Input), & statistik.
│
├ \`#add-class [Nama] | [Deskripsi]\`
│ Daftar kelas baru (Gunakan di Grup Utama).
│
├ \`#assign-class [ID] [MainID]\`
│ Tautkan grup input (Gunakan di Grup Komunitas).
│
├ \`#edit-class nama [Baru]\`
│ Ubah nama kelas.
│
╰ \`#edit-class semester [ID]\`
  Pindah/Aktifkan semester baru.

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 4. SUB-MENU: SEMESTER
    // ============================================================
    if (category === "semester") {
      const text = `📅 *BANTUAN: SEMESTER*

╭── [ *Perintah Semester* ]
│
├ \`#list-semester\`
│ Lihat daftar semester & ID-nya.
│
├ \`#add-semester-ai [Angka]\`
│ Buat semester urut otomatis (misal: 1 s/d 8).
│
├ \`#add-semester [Nama 1] | [Nama 2]\`
│ Tambah semester manual (Batch).
│
├ \`#edit-semester [ID] status 1\`
│ Aktifkan semester (Pindah Semester).
│
╰ \`#delete-semester [ID]\`
  Hapus semester (Hanya jika tidak aktif).

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 5. SUB-MENU: MAPEL
    // ============================================================
    if (category === "mapel") {
      const text = `📚 *BANTUAN: MATA KULIAH*

╭── [ *Perintah Mapel* ]
│
├ \`#list-mapel\`
│ Lihat daftar mapel & ID-nya.
│
├ \`#add-mapel-ai [Deskripsi/Teks]\`
│ Tambah mapel pintar (AI Extract).
│
├ \`#add-mapel [Nama 1] | [Nama 2]\`
│ Tambah manual (Batch).
│
├ \`#edit-mapel [ID] | [Nama Baru]\`
│ Edit nama mapel.
│
╰ \`#delete-mapel [ID 1] [ID 2] ...\`
  Hapus mapel (Bisa banyak sekaligus).

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 6. SUB-MENU: TUGAS
    // ============================================================
    if (category === "tugas" || category === "task") {
      const text = `📝 *BANTUAN: TUGAS / PR*
(Auto Reminder: H-24, H-12, H-6, H-1 Jam)

╭── [ *Perintah Tugas* ]
│
├ \`#list-task (all/done)\`
│ Lihat daftar tugas.
│
├ \`#add-task\`
│ Mode Interaktif (Tanya Jawab).
│
├ \`#add-task-ai [Teks]\`
│ Mode Cepat / Reply Gambar.
│
├ \`#detail-task [ID]\`
│ Cek detail & download lampiran.
│
├ \`#task-status [ID] done\`
│ Tandai selesai dengan cepat.
│
├ \`#edit-task [ID] [Opsi] [Nilai]\`
│ Edit data. Opsi: \`judul\`, \`deadline\`, \`status\`, \`link\`, \`attachment\`, \`tipe\`.
│
╰ \`#delete-task [ID 1] [ID 2]\`
  Hapus tugas & file lampirannya.

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 7. SUB-MENU: REMINDER
    // ============================================================
    if (category === "reminder" || category === "pengingat") {
      const text = `🔔 *BANTUAN: REMINDER*
Pengingat umum (Jadwal, Zoom, Kas).

╭── [ *Perintah Reminder* ]
│
├ \`#list-reminder\`
│ Lihat antrean pengingat.
│
├ \`#reminder-ai [Teks Natural]\`
│ Buat pengingat pintar (Support ulang).
│ Contoh: \`#reminder-ai ingetin makan tiap jam 12\`
│
├ \`#reminder [Pesan] | [Waktu]\`
│ Manual. Format: YYYY-MM-DD HH:mm.
│
├ \`#reminder [Pesan] | [Start] | [Interval] | [End]\`
│ Manual Berulang (5m, 1h, 1d).
│
├ \`#edit-reminder [ID] [Opsi] [Nilai]\`
│ Edit data reminder.
│
╰ \`#delete-reminder [ID]\`
  Hapus pengingat.

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 8. SUB-MENU: MEMBER & UTILS
    // ============================================================
    if (category === "member" || category === "util") {
      const text = `👥 *BANTUAN: MEMBER & UTILS*

╭── [ *Member & Grup* ]
│
├ \`#list-member\`
│ Cek data mahasiswa.
├ \`#add-member [NIM] | [Nama] | [Panggilan]\`
│ Tambah manual (Bisa banyak baris).
├ \`#add-member-ai [Foto/Teks]\`
│ Tambah via Foto Absen/List.
├ \`#edit-member [3DigitNIM] [Opsi] [Nilai]\`
│ Edit data.
├ \`#delete-member [3DigitNIM] ...\`
│ Hapus member (Bisa banyak).
├ \`#randomgrup [Jml] [Judul]\`
│ Acak kelompok.
╰ \`#list-grup\` / \`#detail-grup\`

╭── [ *Utilitas Lain* ]
│
├ \`#stiker\` (Caption di gambar/video)
╰ \`#tag-all\` (Mention semua member)

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }
    
    // ============================================================
    // 9. SUB-MENU: FUN & AI
    // ============================================================
    if (category === "fun" || category === "seru") {
      const text = `🎲 *BANTUAN: FUN & AI*
Fitur hiburan pemecah suasana.

╭── [ *Fun Tools* ]
│
├ \`#kerang-ajaib [Pertanyaan]\`
│ Ramalan AI (Savage/Sarkas Mode).
│
├ \`#diagnosa [@tag]\`
│ Cek penyakit ngawur (AI Roleplay).
│
├ \`#roasting [@tag]\`
│ Minta AI me-roasting teman.
│
├ \`#siapa [Pertanyaan]\`
│ Menuduh member secara acak.
│
╰ \`#pantun [Topik]\`
  Membuat pantun lucu.

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // MENU UTAMA (DEFAULT)
    // ============================================================
    const text = `🤖 *CLASS BOT ASSISTANT*
Halo, *${pushName}*! 👋
Silahkan pilih kategori bantuan di bawah ini:

╭── [ 📌 *MENU KATEGORI* ]
│
├ \`#help setup\` (⭐ PENTING)
│ ⚙️ Panduan Aktivasi Kelas & Member.
│
├ \`#help community\`
│ 🌐 Cara pisah Grup Bot & Grup Utama.
│
├ \`#help tugas\`
│ 📝 Input Tugas (AI/Gambar), List Deadline.
│
├ \`#help reminder\`
│ 🔔 Pengingat Umum (Sekali/Berulang).
│
├ \`#help semester\`
│ 📅 Ganti Semester, Tambah Semester.
│
├ \`#help mapel\`
│ 📚 Tambah (AI), Edit, Hapus Mata Kuliah.
│
├ \`#help member\`
│ 👥 Absensi Siswa, Acak Kelompok.
│
╰ \`#help fun\`
  🎲 Fitur Seru-seruan.

_💡 Tips: Ketik perintah sesuai yang tertera untuk melihat detail cara penggunaannya._

──────────────
*Created by Luqman Oy Oy*`;

    await sock.sendMessage(from, { 
      text: text,
      mentions: [sender]
    });
  },
};