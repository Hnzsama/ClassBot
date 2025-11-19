// commands/general/help.js
module.exports = {
  name: "#help",
  description: "Pusat bantuan. Format: #help [kategori]",
  execute: async (bot, from, sender, args, msg) => {
    const { sock } = bot;
    const pushName = msg.pushName || sender.split("@")[0];
    
    const category = args[0] ? args[0].toLowerCase() : "";

    // ==========================================
    // 1. SUB-MENU: KELAS
    // ==========================================
    if (category === "kelas") {
      const text = `🏫 *BANTUAN: MANAJEMEN KELAS*
Pengaturan dasar identitas kelas & kurikulum.

╭── [ *Perintah Kelas* ]
│
├ \`#info-class\`
│ Melihat status kelas, semester aktif, & statistik.
│
├ \`#add-class [Nama] | [Deskripsi]\`
│ Mendaftarkan grup ini sebagai kelas baru.
│
├ \`#edit-class nama [Nama Baru]\`
│ Mengubah nama kelas.
│
├ \`#edit-class deskripsi [Teks]\`
│ Mengubah deskripsi/motto kelas.
│
╰ \`#edit-class semester [ID]\`
  Pindah semester (Naik tingkat).

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ==========================================
    // 2. SUB-MENU: SEMESTER
    // ==========================================
    if (category === "semester") {
      const text = `📅 *BANTUAN: SEMESTER*
Atur perpindahan semester.

╭── [ *Perintah Semester* ]
│
├ \`#list-semester\`
│ Melihat history semester kelas ini.
│
├ \`#add-semester [Nama]\`
│ Menambah data semester baru.
│ Contoh: \`#add-semester Semester 3\`
│
├ \`#edit-semester [ID] status 1\`
│ Mengaktifkan semester (Pindah Semester).
│ ID dilihat dari list-semester.
│
╰ \`#delete-semester [ID]\`
  Menghapus semester (Tidak bisa jika sedang aktif).

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ==========================================
    // 3. SUB-MENU: MAPEL
    // ==========================================
    if (category === "mapel") {
      const text = `📚 *BANTUAN: MATA KULIAH*
Kelola mapel untuk semester yang aktif.

╭── [ *Perintah Mapel* ]
│
├ \`#list-mapel\`
│ Daftar mapel di semester ini.
│
├ \`#add-mapel [Nama]\`
│ Menambah mapel baru.
│
├ \`#edit-mapel [Nama Lama] | [Baru]\`
│ Mengubah nama mapel (Typo, dll).
│
╰ \`#delete-mapel [Nama]\`
  Menghapus mapel.

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ==========================================
    // 4. SUB-MENU: TUGAS
    // ==========================================
    if (category === "tugas" || category === "task") {
      const text = `📝 *BANTUAN: TUGAS / PR*
Pantau deadline tugas kuliah.

╭── [ *Perintah Tugas* ]
│
├ \`#list-task (all/done)\`
│ Lihat daftar tugas. Default: Pending.
│
├ \`#add-task\`
│ Tambah tugas (Mode Interaktif).
│
├ \`#edit-task [ID] [Opsi] [Nilai]\`
│ Edit info tugas. ID ambil dari list.
│ Opsi: \`judul\`, \`deadline\`, \`status\`, \`link\`.
│ Contoh: \`#edit-task 5 status Selesai\`
│
╰ \`#delete-task [ID]\`
  Menghapus tugas (ID Angka).

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ==========================================
    // 5. SUB-MENU: REMINDER (BARU)
    // ==========================================
    if (category === "reminder" || category === "pengingat") {
      const text = `🔔 *BANTUAN: REMINDER*
Pengingat umum (Zoom, Kas, Pertemuan).

╭── [ *Perintah Reminder* ]
│
├ \`#reminder [Pesan] | [Waktu]\`
│ Pasang pengingat baru.
│ Format Waktu: YYYY-MM-DD HH:mm
│ Contoh: \`#reminder Zoom Pak Budi | 2025-10-20 09:00\`
│
├ \`#list-reminder\`
│ Lihat antrean pengingat yang belum dikirim.
│
╰ \`#delete-reminder [ID]\`
  Batalkan pengingat.

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ==========================================
    // 6. SUB-MENU: MEMBER & UTILS
    // ==========================================
    if (category === "member" || category === "util") {
      const text = `👥 *BANTUAN: MEMBER & LAINNYA*
Manajemen siswa dan utilitas bot.

╭── [ *Member & Grup* ]
│
├ \`#list-member\` (Absensi)
├ \`#add-member NIM | Nama | Panggilan\`
├ \`#edit-member [3Digit] [Opsi] [Nilai]\`
├ \`#delete-member [3Digit]\`
├ \`#randomgrup [Jml] [Judul]\`
╰ \`#list-grup\` (History Kelompok)

╭── [ *Utilitas* ]
│
├ \`#stiker\` (Kirim gambar + caption)
╰ \`#tag-all\` (Mention semua member)

_Ketik_ \`#help\` _untuk kembali ke menu utama._`;
      return await sock.sendMessage(from, { text });
    }

    // ==========================================
    // MENU UTAMA (DEFAULT)
    // ==========================================
    const text = `🤖 *CLASS BOT ASSISTANT*
Halo, *${pushName}*! 👋
Silahkan pilih kategori bantuan di bawah ini:

╭── [ 📌 *MENU KATEGORI* ]
│
├ \`#help kelas\`
│ 🏫 Info Kelas, Edit Nama/Deskripsi.
│
├ \`#help semester\`
│ 📅 Ganti Semester, Tambah Semester.
│
├ \`#help mapel\`
│ 📚 Tambah, Edit, Hapus Mata Kuliah.
│
├ \`#help tugas\`
│ 📝 Input Tugas, List Deadline.
│
├ \`#help reminder\`
│ 🔔 Pengingat Umum (Zoom, Jadwal).
│
├ \`#help member\`
│ 👥 Absensi Siswa, Acak Kelompok.
│
╰ \`#help util\`
  🔧 Stiker, Tag All.

_💡 Tips: Ketik perintah sesuai yang tertera untuk melihat detail cara penggunaannya._

──────────────
*Created by Luqman Oy Oy*`;

    await sock.sendMessage(from, { 
      text: text,
      mentions: [sender]
    });
  },
};