const AIHandler = require('../../utils/aiHandler');

module.exports = {
    name: "#member-add-ai",
    description: "Tambah member via AI (Teks atau Foto Absen).",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, model, db } = bot;

        if (!from.endsWith("@g.us")) return;

        let rawInput = text.replace("#member+ai", "").trim();
        const ai = new AIHandler(bot);

        // --- 1. DETEKSI MEDIA (FOTO/DOC) ---
        const media = await ai.downloadMedia(msg, from);
        const hasMedia = !!media;

        // Validasi Input
        if (!rawInput && !hasMedia) {
            return sock.sendMessage(from, {
                text: "⚠️ *AI MEMBER SCANNER*\n\nFitur ini otomatis mengekstrak data mahasiswa dari *Foto Daftar Hadir* atau *Teks*.\n\n📈 *Cara Pakai:*\nReply foto absen dengan `#member+ai`"
            });
        }

        if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif." });

        try {
            // --- 2. CEK KELAS ---
            const kelas = await db.prisma.class.findFirst({
                where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
            });
            if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

            await sock.sendMessage(from, { react: { text: "🧐", key: msg.key } });

            // --- 3. SYSTEM PROMPT ---
            const systemPrompt = `
      Peran: Data Entry Specialist.
      Tugas: Ekstrak daftar mahasiswa dari gambar atau teks input.
      
      Aturan Ekstraksi:
      1. Identifikasi NIM (Nomor), Nama Lengkap, dan Nama Panggilan.
      2. Jika Panggilan tidak ada, ambil satu kata dari nama depan.
      3. Abaikan baris header/judul/tanda tangan.
      4. Bersihkan typo OCR (misal angka '0' terbaca huruf 'O' di NIM).
      5. NIM harus berupa angka string.

      OUTPUT WAJIB: JSON Array of Objects.
      Format:
      [
        { "nim": "2024001", "nama": "Ahmad Dahlan", "panggilan": "Ahmad" }
      ]
      `;

            // --- 4. EKSEKUSI AI ---
            // Note: prompt construction logic in AIHandler handles text + media
            const result = await ai.generateJSON(systemPrompt, rawInput, media);

            if (!result.success) {
                console.error("AI Error:", result.error || result.raw);
                return sock.sendMessage(from, { text: "❌ *AI BINGUNG*\nGagal membaca data. Pastikan foto jelas." });
            }

            const rawDataArray = result.data;

            if (!Array.isArray(rawDataArray) || rawDataArray.length === 0) {
                return sock.sendMessage(from, { text: `📂 AI tidak menemukan data mahasiswa yang valid.` });
            }

            // --- 6. SIMPAN DATABASE & TRACKING ---
            let report = {
                success: 0,
                skipped: 0,
                samples: [] // Simpan beberapa nama untuk preview
            };

            for (const m of rawDataArray) {
                if (!m.nim || !m.nama) continue;

                // Bersihkan data
                const cleanNim = String(m.nim).replace(/[^0-9]/g, ''); // Pastikan hanya angka
                const cleanNama = m.nama.trim();
                const cleanPanggilan = m.panggilan ? m.panggilan.trim() : cleanNama.split(' ')[0];

                try {
                    // Cek Duplikat Global (NIM Unique)
                    const exist = await db.prisma.member.findUnique({ where: { nim: cleanNim } });

                    if (!exist) {
                        await db.prisma.member.create({
                            data: {
                                classId: kelas.id,
                                nim: cleanNim,
                                nama: cleanNama,
                                panggilan: cleanPanggilan
                            }
                        });
                        report.success++;
                        // Simpan 3 nama pertama untuk preview laporan
                        if (report.success <= 3) report.samples.push(`${cleanNama} (${cleanNim})`);
                    } else {
                        report.skipped++;
                    }
                } catch (err) {
                    console.error(`Error saving member ${cleanNim}:`, err);
                }
            }

            let reply = `🤖 *LAPORAN SCANNER AI*\n`;
            reply += `──────────────────────\n`;
            reply += `🏫 Kelas: ${kelas.name}\n`;
            reply += `📋 Terdeteksi: ${rawDataArray.length} Data\n\n`;

            if (report.success > 0) {
                reply += `✅ *${report.success} BERHASIL DISIMPAN*\n`;
                // Tampilkan preview
                report.samples.forEach(s => reply += `   ├ ${s}\n`);
                if (report.success > 3) reply += `   └ ...dan ${report.success - 3} lainnya\n`;
            } else {
                reply += `⚠️ Tidak ada data baru yang disimpan.\n`;
            }

            if (report.skipped > 0) {
                reply += `\n⛔ *${report.skipped} DUPLIKAT* (Dilewati)\n`;
            }

            reply += `──────────────────────\n`;
            reply += `👤 Admin: @${sender.split("@")[0]}`;

            await sock.sendMessage(from, { text: reply, mentions: [sender] });

        } catch (e) {
            console.error("Error add-member-ai:", e);
            await sock.sendMessage(from, { text: `❌ Terjadi kesalahan sistem AI.` });
        }
    }
};