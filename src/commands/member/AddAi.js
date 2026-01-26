const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "#member-add-ai",
    description: "Tambah member via AI (Teks atau Foto Absen).",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, model, db } = bot;

        if (!from.endsWith("@g.us")) return;

        let rawInput = text.replace("#member+ai", "").trim();

        // --- 1. DETEKSI MEDIA (FOTO/DOC) ---
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let mimeType = "text/plain";
        let hasMedia = false;
        let mediaBuffer = null;

        if (quotedMsg && (quotedMsg.imageMessage || quotedMsg.documentMessage)) {
            try {
                mimeType = quotedMsg.imageMessage ? 'image/jpeg' : 'application/pdf';
                mediaBuffer = await downloadMediaMessage(
                    { key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
                    'buffer',
                    {},
                );
                hasMedia = true;
            } catch (e) {
                console.error("Download Error:", e);
                return sock.sendMessage(from, { text: "❌ Gagal mengunduh media." });
            }
        }

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

            let parts = [systemPrompt];
            if (hasMedia) {
                parts.push({ text: `Input Tambahan: "${rawInput}" (Prioritaskan Gambar)` });
                parts.push({ inlineData: { mimeType: mimeType, data: mediaBuffer.toString('base64') } });
            } else {
                parts.push({ text: `Input Teks: "${rawInput}"` });
            }

            // --- 4. EKSEKUSI AI ---
            const result = await model.generateContent(parts);
            const aiResponse = result.response.text();

            // --- 5. PARSING JSON ---
            let rawDataArray = [];
            try {
                const jsonMatch = aiResponse.match(/\[.*?\]/s);
                if (!jsonMatch) throw new Error("JSON Array not found");
                rawDataArray = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error("AI Parse Error:", aiResponse);
                return sock.sendMessage(from, { text: "❌ *AI BINGUNG*\nGagal membaca data. Pastikan foto jelas." });
            }

            if (rawDataArray.length === 0) {
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