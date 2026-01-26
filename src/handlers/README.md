# Private Chat Handler - Basis Data PJ

Fitur untuk mengelola percakapan private dengan nomor 081231511389 menggunakan Gemini AI sebagai PJ Mata Kuliah Basis Data.

## Fitur

✅ **Lock Conversation** - Hanya nomor 081231511389 yang bisa berkomunikasi  
✅ **AI-Powered Response** - Gemini AI sebagai PJ Basis Data  
✅ **Conversation History** - Menyimpan riwayat percakapan per user  
✅ **Schedule Detection** - Otomatis mendeteksi jadwal yang sudah pasti  
✅ **Auto Summary** - Kirim ringkasan ke grup ketika jadwal confirmed  
✅ **Professional Tone** - Response selalu sopan dan manusiawi  

## Cara Kerja

1. **User mengirim pesan private** ke bot dari nomor 081231511389
2. **Handler mendeteksi** private message dan memproses dengan Gemini AI
3. **Gemini berperan sebagai PJ Basis Data** dan:
   - Membantu menjadwalkan kelas
   - Menjawab pertanyaan tentang materi
   - Menganalisa percakapan untuk mendapat jadwal pasti
4. **Ketika jadwal confirmed** (response berisi "✅ JADWAL CONFIRMED"):
   - Buat summary percakapan
   - Kirim summary ke grup 120363421309923905@g.us
   - Clear conversation history
5. **User mendapat notifikasi** bahwa jadwal sudah dikonfirmasi

## Konfigurasi

### Nomor Allowed
Edit di `src/handlers/privateBasisData.js`:
```javascript
const allowedNumber = "081231511389@s.whatsapp.net";
```

### Target Group ID
Edit di `src/handlers/privateBasisData.js`:
```javascript
const groupId = "120363421309923905@g.us";
```

### System Prompt
Ubah role/personality di bagian `systemPrompt` sesuai kebutuhan.

## Response Format

Bot akan merespons setiap pesan dengan:
- Analisa percakapan dari Gemini
- Pertanyaan untuk mendapat informasi jadwal
- Konfirmasi ketika jadwal sudah pasti

Contoh respons:
```
Halo! 👋 Saya adalah PJ Mata Kuliah Basis Data.

Saya ingin membantu Anda menjadwalkan kelas Basis Data.

Beberapa pertanyaan:
1. Kapan Anda tersedia untuk mengambil kelas?
2. Apakah Anda lebih suka online atau offline?
3. Berapa lama durasi kelas yang Anda inginkan?
4. Topik atau materi apa yang ingin dibahas?

Mohon berbagi informasi tersebut sehingga kami dapat membuat jadwal yang sesuai. 😊
```

## Trigger Confirmation

Ketika percakapan menghasilkan jadwal yang pasti, Gemini akan merespons dengan:
```
✅ JADWAL CONFIRMED
[Details jadwal...]
```

Ini akan trigger pengiriman summary ke grup.

## Struktur File

```
src/handlers/
├── privateBasisData.js    # Main handler logic
└── README.md             # Dokumentasi ini
```

## Integrasi

Handler sudah terintegrasi di `src/index.js` pada bagian `messages.upsert` event.

Setiap pesan private akan:
1. Dideteksi oleh private message check
2. Diproses oleh privateBasisData handler
3. Di-skip dari command processing normal

## Error Handling

- Jika Gemini AI tidak dikonfigurasi → Respons error message
- Jika nomor tidak authorized → Respons pesan ditolak
- Jika error saat generate response → Respons error dan log error

## Monitoring

Cek console logs untuk:
```
[MSG] Private message dari user
Error in privateBasisData handler: [error details]
```

## Tips

1. **Customize system prompt** untuk mengubah behavior bot
2. **Adjust confirmation trigger** jika "✅ JADWAL CONFIRMED" tidak sesuai
3. **Monitor conversation history** untuk debugging
4. **Test dengan nomor authorized** sebelum deploy
