const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Helper Title Case
function toTitleCase(str) {
    if (!str) return "";
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

module.exports = {
    name: "#member-ai",
    description: "Manage Member (Add/Edit/Delete) via AI.",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, model, db } = bot;
        if (!from.endsWith("@g.us")) return;

        let rawInput = text.replace("#member-ai", "").trim();

        // --- 1. DETEKSI MEDIA ---
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let mediaPart = null; let hasMedia = false;
        if (quotedMsg && (quotedMsg.imageMessage || quotedMsg.documentMessage)) {
            try {
                const buffer = await downloadMediaMessage({ key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg }, 'buffer', {});
                mediaPart = { inlineData: { data: buffer.toString("base64"), mimeType: quotedMsg.imageMessage ? 'image/jpeg' : 'application/pdf' } };
                hasMedia = true;
            } catch (e) { }
        }

        if (!rawInput && !hasMedia) return sock.sendMessage(from, { text: "⚠️ Masukkan instruksi atau foto." });
        if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI mati." });

        try {
            const kelas = await db.prisma.class.findFirst({ where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } });
            if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

            await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

            // --- 2. CONTEXT INJECTION ---
            const existingMembers = await db.prisma.member.findMany({
                where: { classId: kelas.id },
                select: { nim: true, nama: true, panggilan: true },
                take: 200
            });

            // Format: "075:Fatwa(Pgl:Fatwa) | ..."
            const contextStr = existingMembers.length > 0
                ? existingMembers.map(m => `${m.nim}:${m.nama}${m.panggilan ? `(Pgl:${m.panggilan})` : ''}`).join(" | ")
                : "Database Kosong";

            // --- 3. PROMPT (FIELD AWARENESS) ---
            const systemPrompt = `
      Peran: Database Admin.
      DATA SAAT INI: [ ${contextStr} ]

      TUGAS: Tentukan aksi (ADD, EDIT, DELETE) berdasarkan input user.

      ATURAN EDIT FIELD (PENTING):
      1. Jika user bilang "Ganti Nama Panggilan" atau "Set Panggilan" -> Isi field 'panggilan'. JANGAN isi field 'nama'.
      2. Jika user bilang "Ganti Nama" atau "Salah Nama" -> Isi field 'nama'.
      3. Jika user bilang "Ganti NIM" -> Isi field 'newNim'.
      
      INSTRUKSI TABEL (JIKA GAMBAR):
      - Kolom NIM = Angka.
      - Kolom Nama = Nama Lengkap.
      - Jika NIM sudah ada di DATA SAAT INI, cek apakah Namanya beda? Jika beda, EDIT 'nama'.

      OUTPUT JSON Array:
      [ 
        { "action": "edit", "nim": "075", "panggilan": "Wawa" },  <-- Contoh ganti panggilan
        { "action": "edit", "nim": "078", "nama": "Nama Lengkap Baru" }, <-- Contoh ganti nama
        { "action": "add", "nim": "080", "nama": "Baru", "panggilan": "Bar" }
      ]
      `;

            let parts = [systemPrompt];
            if (hasMedia) { parts.push({ text: `Input Tambahan: "${rawInput}"` }); parts.push(mediaPart); }
            else { parts.push({ text: `Input User: "${rawInput}"` }); }

            const result = await model.generateContent(parts);
            let actionsList = [];
            try {
                const jsonMatch = result.response.text().match(/\[.*?\]/s);
                actionsList = JSON.parse(jsonMatch[0]);
            } catch (e) { return sock.sendMessage(from, { text: "❌ AI bingung membaca instruksi." }); }

            // --- 4. EXECUTE DB ---
            let report = { add: [], edit: [], delete: [], errors: [] };

            for (const item of actionsList) {
                const nim = item.nim ? String(item.nim).replace(/[^0-9]/g, '') : null;
                if (!nim) continue;

                try {
                    // ADD
                    if (item.action === 'add') {
                        const exist = await db.prisma.member.findUnique({ where: { nim } });
                        if (!exist) {
                            const fName = toTitleCase(item.nama || "Tanpa Nama");
                            const fNick = item.panggilan ? toTitleCase(item.panggilan) : fName.split(' ')[0];
                            await db.prisma.member.create({ data: { classId: kelas.id, nim, nama: fName, panggilan: fNick } });
                            report.add.push(`${fName} (${nim})`);
                        } else {
                            // Auto-Edit Logic jika add duplikat tapi nama beda
                            const fName = toTitleCase(item.nama);
                            if (fName && exist.nama !== fName && fName.length > 3) {
                                await db.prisma.member.update({ where: { nim }, data: { nama: fName } });
                                report.edit.push(`Nama: ${fName} (${nim})`);
                            }
                        }
                    }
                    // EDIT
                    else if (item.action === 'edit') {
                        const updateData = {};
                        let changeLog = `(${nim})`;

                        // Logic mapping field agar tidak tertukar
                        if (item.nama) {
                            updateData.nama = toTitleCase(item.nama);
                            changeLog += ` Nama ➔ ${updateData.nama}`;
                        }
                        if (item.panggilan) {
                            updateData.panggilan = toTitleCase(item.panggilan);
                            changeLog += ` Pgl ➔ "${updateData.panggilan}"`;
                        }
                        if (item.newNim) {
                            const newNim = String(item.newNim).replace(/[^0-9]/g, '');
                            const existNew = await db.prisma.member.findUnique({ where: { nim: newNim } });
                            if (!existNew) {
                                updateData.nim = newNim;
                                changeLog += ` NIM ➔ ${newNim}`;
                            } else {
                                report.errors.push(`Gagal ganti NIM ${nim} (Dipakai)`);
                            }
                        }

                        if (Object.keys(updateData).length > 0) {
                            await db.prisma.member.update({ where: { nim }, data: updateData });
                            report.edit.push(changeLog);
                        }
                    }
                    // DELETE
                    else if (item.action === 'delete') {
                        const target = await db.prisma.member.findUnique({ where: { nim } });
                        if (target) {
                            await db.prisma.member.delete({ where: { nim } });
                            report.delete.push(`${target.nama} (${nim})`);
                        }
                    }
                } catch (e) { if (e.code !== 'P2025') report.errors.push(`Err: ${nim}`); }
            }

            // --- 5. LAPORAN KEREN ---
            let reply = `🤖 *LAPORAN AI MEMBER*\n──────────────────────\n`;
            reply += `🏫 Kelas: ${kelas.name}\n\n`;
            let hasChange = false;

            if (report.add.length) {
                reply += `✅ *Ditambah (${report.add.length}):*\n`;
                if (report.add.length > 5) reply += `• ${report.add[0]} ... (+${report.add.length - 1})\n`;
                else reply += report.add.map(s => `• ${s}`).join('\n') + `\n`;
                hasChange = true; reply += `\n`;
            }

            if (report.edit.length) {
                reply += `✏️ *Diedit (${report.edit.length}):*\n` + report.edit.map(s => `• ${s}`).join('\n') + `\n\n`;
                hasChange = true;
            }

            if (report.delete.length) {
                reply += `🗑️ *Dihapus (${report.delete.length}):*\n` + report.delete.map(s => `• ~${s}~`).join('\n') + `\n\n`;
                hasChange = true;
            }

            if (!hasChange) reply += `⚠️ Data sudah sinkron (Tidak ada perubahan).\n`;
            if (report.errors.length) reply += `⛔ *Log:* ${report.errors.join(', ')}`;

            await sock.sendMessage(from, { text: reply });
        } catch (e) { console.error(e); }
    }
};