# 🤖 Class Bot Assistant (WhatsApp)

**Class Bot Assistant** adalah bot WhatsApp cerdas yang dirancang untuk mengelola aktivitas akademik kelas secara otomatis. Dibangun menggunakan **Node.js**, **Baileys** (WhatsApp Web API), dan **Prisma ORM**, bot ini mengintegrasikan kecerdasan buatan **Google Gemini** untuk mempermudah input tugas, penjadwalan, dan interaksi kelas yang lebih hidup.

![Bot Banner](/src/assets/banner.gif) ## ✨ Fitur Utama

### 📚 Manajemen Akademik
- **Manajemen Kelas & Semester:** Mendukung *multi-tenancy* (banyak kelas dalam satu bot).
- **Mata Kuliah (Mapel):** Tambah, edit, dan hapus mata kuliah per semester.
- **Tugas Kuliah (Tasks):**
  - Input Cepat via AI (Text/Gambar).
  - Pengingat Deadline Otomatis (H-24, H-12, H-6, H-1 Jam).
  - Dukungan Lampiran File (PDF/Gambar) yang tersimpan lokal.
  - Status Tugas (Pending, Selesai, Terlewat).

### ⏰ Penjadwalan & Pengingat
- **Smart Reminder:** Buat pengingat umum dengan bahasa alami (contoh: *"ingetin futsal tiap senin jam 4 sore"*).
- **Auto-Schedule:** Cron job berjalan setiap menit untuk ketepatan waktu.
- **Motivasi Harian:** Pesan otomatis jam 00:00 (Motivasi Malam) dan 07:00 (Pagi).

### 🛡️ Keamanan & Moderasi
- **Dual-Group Architecture:** Memisahkan **Grup Utama** (Output/Info) dan **Grup Komunitas** (Input/Spam) agar informasi penting tidak tenggelam.
- **Anti-Toxic:** Filter kata kasar otomatis dengan Regex + AI Vision untuk mendeteksi stiker/gambar tidak pantas (NSFW/Hate Speech).
- **VIP Media Alert:** Peringatan khusus jika VIP mengirim file (untuk keamanan/testing).

### 🎲 Hiburan & Utilitas
- **Kerang Ajaib AI:** Ramalan kocak dengan kepribadian yang bisa diatur (Sarkas/Savage).
- **AI Tools:** `#diagnosa` (Cek penyakit ngawur), `#roasting` (Ejek teman), `#pantun`.
- **Stiker Maker:** Konversi gambar/video menjadi stiker WA.
- **Tag All:** Mention semua member (Admin Only).

---

## 🛠️ Teknologi

- **Runtime:** Node.js (v20+ Recommended)
- **WhatsApp API:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- **Database:** SQLite (via Prisma ORM)
- **AI Engine:** Google Gemini 1.5 Flash
- **Scheduler:** Node-Cron
- **Media Processing:** FFmpeg

---

## 🚀 Cara Instalasi & Menjalankan

### Prasyarat
1.  Node.js & NPM terinstal.
2.  FFmpeg terinstal (untuk fitur stiker).
3.  API Key Google Gemini (Dapatkan di [Google AI Studio](https://aistudio.google.com/)).

### Langkah 1: Clone & Install
```bash
git clone [https://github.com/username/class-bot.git](https://github.com/username/class-bot.git)
cd class-bot
npm install