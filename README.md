# 🤖 Class Bot Assistant (WhatsApp)

**Class Bot Assistant** adalah bot WhatsApp cerdas yang dirancang untuk mengelola aktivitas akademik kelas secara otomatis. Dibangun menggunakan **Node.js**, **Baileys** (WhatsApp Web API), dan **Prisma ORM**, bot ini mengintegrasikan kecerdasan buatan **Google Gemini** untuk mempermudah input tugas, penjadwalan, dan interaksi kelas yang lebih hidup.

![Bot Banner](/src/assets/banner.gif)

---

## 📚 Fitur Manajemen Akademik

- **Manajemen Kelas & Semester:** Mendukung *multi-tenancy* (banyak kelas dalam satu bot).
- **Mata Kuliah (Mapel):** Tambah, edit, dan hapus mata kuliah per semester.
- **Tugas Kuliah (Tasks):**
  - Input cepat via AI (teks/gambar).
  - Pengingat deadline otomatis (H-24, H-12, H-6, H-1 jam).
  - Dukungan lampiran file (PDF/Gambar) tersimpan lokal.
  - Status tugas (Pending, Selesai, Terlewat).

---

## ⏰ Penjadwalan & Pengingat

- **Smart Reminder:** Buat pengingat menggunakan bahasa alami (contoh: *"ingetin futsal tiap senin jam 4 sore"*).
- **Auto-Schedule:** Cron job berjalan setiap menit untuk ketepatan waktu.
- **Motivasi Harian:** Pesan otomatis jam 00:00 (Motivasi Malam) dan 07:00 (Pagi).

---

## 🛡️ Keamanan & Moderasi

- **Dual-Group Architecture:** Memisahkan **Grup Utama** (Output/Info) dan **Grup Komunitas** (Input/Chat) agar informasi penting tidak tenggelam.
- **Anti-Toxic:** Filter kata kasar otomatis dengan Regex + AI Vision (deteksi stiker/gambar tidak pantas: NSFW/Hate Speech).
- **VIP Media Alert:** Peringatan khusus jika VIP mengirim file (untuk keamanan/testing).

---

## 🎲 Hiburan & Utilitas

- **Kerang Ajaib AI:** Jawaban random dengan personality yang bisa diatur (Sarkas/Savage).
- **AI Tools:** `#diagnosa` (diagnosa kocak), `#roasting`, `#pantun`.
- **Stiker Maker:** Konversi gambar/video menjadi stiker WA.
- **Tag All:** Mention semua member (Admin Only).

---

## 🛠️ Teknologi

- **Runtime:** Node.js (v20+ recommended)
- **WhatsApp API:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- **Database:** SQLite (via Prisma ORM)
- **AI Engine:** Google Gemini 1.5 Flash
- **Scheduler:** Node-Cron
- **Media Processing:** FFmpeg

---

## 🚀 Cara Instalasi & Menjalankan

### 1. Prasyarat
- Node.js & NPM terinstal.
- FFmpeg terinstal.
- API Key Google Gemini (dapatkan di Google AI Studio).

---

### 2. Clone & Install

```bash
git clone https://github.com/Hnzsama/ClassBot.git
cd ClassBot
npm install
```

### 3. Konfigurasi Environment
Salin file `.env` dan sesuaikan:

```bash
cp .env.example .env
```
> **Note:** Jika tidak ada `.env.example`, buat file `.env` manual dan isi variable yang dibutuhkan (DATABASE_URL, GEMINI_API_KEY, dll).

### 4. Setup Database (Prisma)
Siapkan database SQLite:

```bash
# Generate Prisma Client
npx prisma generate

# Push Schema ke Database (Sync)
npx prisma db push
```

### 5. Instalasi FFmpeg (Wajib untuk Media)
Pastikan FFmpeg terinstal dan terbaca di terminal (`ffmpeg -version`).
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt update && sudo apt install ffmpeg -y
  ```
- **Windows:** Download dari situs resmi, ekstrak, dan masukkan `bin` folder ke 'Environment Variables > Path'.

### 6. Jalankan Bot
```bash
npm start
```
Scan QR Code yang muncul untuk login.
