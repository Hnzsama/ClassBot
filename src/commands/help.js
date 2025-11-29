module.exports = {
  name: "#help",
  description: "Pusat bantuan bot. Format: #help [kategori]",
  execute: async (bot, from, sender, args, msg) => {
    const { sock } = bot;
    const pushName = msg.pushName || sender.split("@")[0];
    
    const category = args[0] ? args[0].toLowerCase() : "";

    // ============================================================
    // 1. SUB-MENU: SETUP
    // ============================================================
    if (category === "setup" || category === "panduan") {
      const text = `⚙️ *PANDUAN SETUP ADMIN*

*1. BUAT KELAS (Di Grup Utama)*
Ketik: \`#add-class [Nama], [Deskripsi]\`
_(Gunakan koma sebagai pemisah)_

*2. KURIKULUM (Semester & Mapel)*
Ketik: \`#semester-ai Buatkan semester 1 sampai 8 lalu aktifkan semester 1\`
Ketik: \`#mapel-ai Tambahkan mapel Matematika, Algoritma, Basis Data\`

*3. DATA MAHASISWA*
Ketik: \`#add-member-ai\`
_(Lalu kirim foto absensi/list nama)_

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 2. SUB-MENU: COMMUNITY
    // ============================================================
    if (category === "community") {
      const text = `🌐 *BANTUAN: COMMUNITY GROUP*
Pisahkan Grup Info (Output) & Grup Chat (Input).

*PERINTAH:*
├ \`#add-class [Nama], [Deskripsi]\`
│ (Jalankan di Grup Utama/Info).
│
╰ \`#assign-class [Class ID] [Main Group ID]\`
  (Jalankan di Grup Komunitas/Chat).

_Ketik_ \`#help\` _untuk kembali._`;
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
│ Cek status kelas & statistik.
│
├ \`#add-class [Nama], [Deskripsi]\`
│ Daftar kelas baru (Gunakan Koma).
│
├ \`#edit-class nama [Baru]\`
│ Ubah nama kelas (Gunakan Spasi).
│
╰ \`#edit-class semester [ID]\`
  Pindah/Aktifkan semester baru.

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 4. SUB-MENU: SEMESTER
    // ============================================================
    if (category === "semester") {
      const text = `📅 *BANTUAN: SEMESTER*

╭── [ *AI Manager (Rekomendasi)* ]
│
╰ \`#semester-ai [Instruksi Natural]\`
  Contoh: "Buatkan semester 1-8 lalu aktifkan smt 3"
  Contoh: "Ganti nama semester 9 jadi Skripsi"

╭── [ *Manual* ]
│
├ \`#list-semester\`
│ Lihat daftar semester.
│
├ \`#add-semester [Nama 1], [Nama 2]\`
│ Tambah manual (Batch dg Koma).
│
├ \`#edit-semester [ID] status 1\`
│ Aktifkan semester (Gunakan Spasi).
│
╰ \`#delete-semester [ID]\`
  Hapus semester.

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 5. SUB-MENU: MAPEL
    // ============================================================
    if (category === "mapel") {
      const text = `📚 *BANTUAN: MATA KULIAH*

╭── [ *AI Manager (Rekomendasi)* ]
│
╰ \`#mapel-ai [Instruksi/Foto]\`
  Reply foto jadwal atau ketik perintah:
  "Tambah Algoritma dan Pkn, hapus Matematika"

╭── [ *Manual* ]
│
├ \`#list-mapel\`
│ Lihat daftar mapel.
│
├ \`#add-mapel [Nama 1], [Nama 2]\`
│ Tambah manual (Batch dg Koma).
│
├ \`#edit-mapel [ID] [Nama Baru]\`
│ Edit nama mapel (Gunakan Spasi).
│
╰ \`#delete-mapel [ID]\`
  Hapus mapel.

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 6. SUB-MENU: TUGAS
    // ============================================================
    if (category === "tugas" || category === "task") {
      const text = `📝 *BANTUAN: TUGAS / PR*
(Auto Close: Tugas otomatis selesai jika waktu habis)

╭── [ *AI Manager (Rekomendasi)* ]
│
╰ \`#task-ai [Instruksi/Foto]\`
  "Tambah tugas Algo deadline besok judul Array"
  "Hapus tugas Pkn"
  "Ganti deadline tugas Basis Data jadi lusa"

╭── [ *Manual* ]
│
├ \`#list-task (all/done)\`
│ Lihat daftar tugas.
│
├ \`#add-task\`
│ Mode Tanya-Jawab Interaktif.
│
├ \`#detail-task [ID]\`
│ Cek detail & lampiran.
│
├ \`#task-status [ID] done\`
│ Tandai selesai.
│
├ \`#edit-task [ID] [Opsi] [Nilai]\`
│ Edit data (Gunakan Spasi).
│
╰ \`#delete-task [ID]\`
  Hapus tugas & filenya.

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 7. SUB-MENU: REMINDER
    // ============================================================
    if (category === "reminder") {
      const text = `🔔 *BANTUAN: REMINDER*
Pengingat umum (Jadwal, Zoom, Kas).

╭── [ *Perintah Reminder* ]
│ Gunakan Koma ( , ) untuk ADD.
│
├ \`#list-reminder\`
│ Lihat antrean pengingat.
│
├ \`#reminder [Pesan], [Waktu]\`
│ Manual. Format: YYYY-MM-DD HH:mm.
│
├ \`#reminder [Pesan], [Start], [Interval], [End]\`
│ Manual Berulang (5m, 1h, 1d).
│ Contoh: \`#reminder Piket, 2025-11-20 07:00, 1d, 2025-11-25\`
│
├ \`#edit-reminder [ID] [Opsi] [Nilai]\`
│ Edit data reminder (Gunakan Spasi).
│
╰ \`#delete-reminder [ID]\`
  Hapus pengingat.

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }

    // ============================================================
    // 8. SUB-MENU: MEMBER
    // ============================================================
    if (category === "member" || category === "util") {
      const text = `👥 *BANTUAN: MEMBER & UTILS*

╭── [ *AI Manager (Rekomendasi)* ]
│
╰ \`#member-ai [Instruksi/Foto]\`
  "Tambah data dari foto ini"
  "Ubah NIM 1 digit jadi 2 digit (tambah 0)"
  "Hapus Budi, ganti nama Siti jadi Siti Aminah"

╭── [ *Manual* ]
│
├ \`#list-member\`
│ Cek data mahasiswa.
├ \`#add-member\`
│ Input banyak: NIM, Nama, Panggilan (Koma).
├ \`#edit-member [NIM] [Opsi] [Nilai]\`
│ Edit data (Gunakan Spasi).
├ \`#delete-member [NIM]\`
│ Hapus member.
├ \`#randomgrup [Jml] [Judul]\`
│ Acak kelompok.

_Ketik_ \`#help\` _untuk kembali._`;
      return await sock.sendMessage(from, { text });
    }
    
    // ============================================================
    // 9. SUB-MENU: FUN (AI & EDUKASI)
    // ============================================================
    if (category === "fun" || category === "seru" || category === "ai") {
      const text = `🤖 *BANTUAN: AI & EDUKASI*

╭── [ *🎓 Asisten Belajar* ]
│
├ \`#tanya-dosen [Pertanyaan]\`
│ Chat dengan AI mode Dosen (Agak killer tapi pintar).
│
╰ \`#jelaskan [Materi/Topik]\`
  Minta penjelasan materi kuliah yang rumit jadi simpel.

╭── [ *🎲 Hiburan & Games* ]
│
├ \`#pantun [Topik]\`
│ Buat pantun lucu otomatis.
│
├ \`#siapa [Pertanyaan]\`
│ Menuduh member grup secara acak.
│
╰ \`#kerang-ajaib [Pertanyaan]\`
  Ramalan ajaib (Ya/Tidak/Mungkin).

_Ketik_ \`#help\` _untuk kembali._`;
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
│ 📝 Input Tugas (AI/Gambar), Prioritas.
│
├ \`#help reminder\`
│ 🔔 Pengingat Umum (Sekali/Berulang).
│
├ \`#help semester\`
│ 📅 Ganti Semester, Tambah Semester.
│
├ \`#help mapel\`
│ 📚 Tambah, Edit, Hapus Mata Kuliah.
│
├ \`#help member\`
│ 👥 Absensi Siswa, Acak Kelompok.
│
╰ \`#help fun\`
  🎲 Fitur AI, Dosen Bot, & Games.

──────────────
*Created by Luqman Oy Oy*`;

    await sock.sendMessage(from, { 
      text: text,
      mentions: [sender]
    });
  },
};