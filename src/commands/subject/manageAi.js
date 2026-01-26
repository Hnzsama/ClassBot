const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function toTitleCase(str) {
    if (!str) return "";
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

module.exports = {
    name: "#subject-ai",
    alias: ["#mapel-ai"],
    description: "Manage Subjects (Add/Edit/Del/etc) via AI.",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, model, db } = bot;
        if (!from.endsWith("@g.us")) return;

        let rawInput = text.replace("#mapel-ai", "").trim();

        // --- 1. DETEKSI MEDIA & QUOTED TEXT ---
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let mediaPart = null;
        let hasMedia = false;
        let quotedTextBody = ""; // Variabel untuk menampung teks yang di-reply

        if (quotedMsg) {
            // A. Cek Gambar
            if (quotedMsg.imageMessage) {
                try {
                    const buffer = await downloadMediaMessage(
                        { key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
                        'buffer',
                        {},
                    );
                    mediaPart = { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } };
                    hasMedia = true;
                } catch (e) { console.error("Gagal download gambar:", e); }
            }

            // B. Cek Teks (Conversation / ExtendedText)
            // Ini penting agar "tambahkan mapel ini" (reply text) bisa jalan
            quotedTextBody = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
        }

        // Validasi: Harus ada input (Langsung / Reply Foto / Reply Teks)
        if (!rawInput && !hasMedia && !quotedTextBody) {
            return sock.sendMessage(from, {
                text: "⚠️ *AI MAPEL MANAGER*\n\nCara Pakai:\n1. Ketik instruksi: `#mapel-ai tambah Algoritma`\n2. Reply foto jadwal: `#mapel-ai masukin ini`\n3. Reply chat list mapel: `#mapel-ai simpan list ini`"
            });
        }

        if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI mati." });

        try {
            // --- 2. CEK KELAS ---
            const kelas = await db.prisma.class.findFirst({ where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }, include: { semesters: { where: { isActive: true } } } });
            if (!kelas || !kelas.semesters[0]) return sock.sendMessage(from, { text: "❌ Tidak ada semester aktif." });
            const activeSem = kelas.semesters[0];

            await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

            // --- 3. CONTEXT INJECTION ---
            const existingSubjects = await db.prisma.subject.findMany({ where: { semesterId: activeSem.id } });
            const contextStr = existingSubjects.map(s => s.name).join(", ") || "Belum ada mapel";

            // --- 4. PROMPT AI ---
            const systemPrompt = `
      Peran: Academic Admin.
      DATA MAPEL SAAT INI: [ ${contextStr} ]
      
      TUGAS: Analisis input user dan tentukan aksi (ADD, EDIT, DELETE).

      SUMBER INPUT:
      1. Instruksi Langsung: "${rawInput}"
      2. Teks yang Di-reply: "${quotedTextBody}" (Prioritaskan isi ini jika instruksi bilang "ini" atau "terlampir").

      LOGIKA KHUSUS:
      1. "add": Tambah mapel baru. Jika input berupa list panjang, pecah jadi banyak object.
      2. "edit": Ganti nama mapel.
      3. "delete": Hapus mapel.

      ATURAN TARGET:
      - "target": Nama mapel lama (cari yang mirip di DATA SAAT INI).
      - "newName": Nama baru (Format Title Case).

      OUTPUT JSON Array:
      [
        { "action": "add", "newName": "Algoritma" },
        { "action": "delete", "target": "Matematika" }
      ]
      `;

            let parts = [systemPrompt];
            // Jika ada gambar, lampirkan
            if (hasMedia) {
                parts.push(mediaPart);
            }
            // Kirim Teks input user lagi sebagai penegas
            parts.push({ text: `Input User: "${rawInput}"` });

            // --- 5. EXECUTE AI ---
            const result = await model.generateContent(parts);
            let actionsList = [];
            try {
                const jsonMatch = result.response.text().match(/\[.*?\]/s);
                if (!jsonMatch) throw new Error();
                actionsList = JSON.parse(jsonMatch[0]);
            } catch (e) { return sock.sendMessage(from, { text: "❌ AI bingung membaca instruksi." }); }

            // --- 6. EXECUTE DB ---
            let report = { add: [], edit: [], del: [], errors: [] };

            for (const item of actionsList) {
                try {
                    // === ADD ===
                    if (item.action === 'add' && item.newName) {
                        const fName = toTitleCase(item.newName);
                        const exist = existingSubjects.find(s => s.name.toLowerCase() === fName.toLowerCase());
                        if (!exist) {
                            const created = await db.prisma.subject.create({ data: { semesterId: activeSem.id, name: fName } });
                            existingSubjects.push(created);
                            report.add.push(fName);
                        } else report.errors.push(`Add: "${fName}" sdh ada`);
                    }
                    // === DELETE ===
                    else if (item.action === 'delete' && item.target) {
                        const target = existingSubjects.find(s => s.name.toLowerCase().includes(item.target.toLowerCase()));
                        if (target) {
                            const taskCount = await db.prisma.task.count({ where: { classId: kelas.id, mapel: target.name } });
                            if (taskCount > 0) report.errors.push(`Hapus: "${target.name}" gagal (Ada ${taskCount} tugas)`);
                            else {
                                await db.prisma.subject.delete({ where: { id: target.id } });
                                const idx = existingSubjects.indexOf(target);
                                if (idx > -1) existingSubjects.splice(idx, 1);
                                report.del.push(target.name);
                            }
                        } else report.errors.push(`Hapus: "${item.target}" tdk ketemu`);
                    }
                    // === EDIT ===
                    else if (item.action === 'edit' && item.target && item.newName) {
                        const target = existingSubjects.find(s => s.name.toLowerCase().includes(item.target.toLowerCase()));
                        if (target) {
                            const fNew = toTitleCase(item.newName);
                            await db.prisma.subject.update({ where: { id: target.id }, data: { name: fNew } });
                            report.edit.push(`${target.name} ➔ ${fNew}`);
                            target.name = fNew;
                        } else report.errors.push(`Edit: "${item.target}" tdk ketemu`);
                    }
                } catch (e) { console.error(e); }
            }

            // --- 7. LAPORAN ---
            let reply = `🤖 *LAPORAN AI MAPEL*\n──────────────────────\n📅 Semester: ${activeSem.name}\n\n`;
            let hasChange = false;

            if (report.add.length) { reply += `✅ *Ditambah:*\n` + report.add.map(s => `• ${s}`).join('\n') + `\n\n`; hasChange = true; }
            if (report.edit.length) { reply += `✏️ *Diedit:*\n` + report.edit.map(s => `• ${s}`).join('\n') + `\n\n`; hasChange = true; }
            if (report.del.length) { reply += `🗑️ *Dihapus:*\n` + report.del.map(s => `• ~${s}~`).join('\n') + `\n\n`; hasChange = true; }

            if (!hasChange) reply += `⚠️ Tidak ada perubahan data.\n`;
            if (report.errors.length) reply += `⛔ *Info:* ${report.errors.join(', ')}`;

            reply += `──────────────────────\n💡 _Cek hasil: #list-mapel_`;

            await sock.sendMessage(from, { text: reply, mentions: [sender] });

        } catch (e) { console.error(e); }
    }
};