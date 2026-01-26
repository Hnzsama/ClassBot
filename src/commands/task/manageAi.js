const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = path.join(process.cwd(), 'media_tasks');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Utility: Parsing Waktu WIB
const parseWIB = (timeStr) => {
    if (!timeStr) return null;
    const cleanTime = timeStr.replace(/[^\d\-: ]/g, "").trim();
    const isoStart = cleanTime.replace(" ", "T") + ":00+07:00";
    const date = new Date(isoStart);
    return isNaN(date.getTime()) ? null : date;
}

module.exports = {
    name: "#task-ai",
    description: "Manage Tasks Complete (Add/Edit/Del/Link/etc) via AI.",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, model, db } = bot;
        if (!from.endsWith("@g.us")) return;

        let rawInput = text.replace("#task-ai", "").trim();

        // --- 1. DETEKSI MEDIA ---
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let mediaPart = null; let hasMedia = false; let attachData = null;

        const isAttachMode = rawInput.includes("--lampiran");
        rawInput = rawInput.replace("--lampiran", "").trim();

        if (quotedMsg) {
            const type = Object.keys(quotedMsg).find(k => ['imageMessage', 'videoMessage', 'documentMessage'].includes(k));
            if (type) {
                try {
                    const buffer = await downloadMediaMessage({ key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg }, 'buffer', {});
                    if (isAttachMode) {
                        const ext = quotedMsg[type].mimetype.split('/')[1] || 'bin';
                        const fName = `${Date.now()}_ai.${ext}`;
                        fs.writeFileSync(path.join(MEDIA_DIR, fName), buffer);
                        attachData = JSON.stringify({ type, mimetype: quotedMsg[type].mimetype, localFilePath: path.join(MEDIA_DIR, fName) });
                    } else {
                        mediaPart = { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } };
                        hasMedia = true;
                    }
                } catch (e) { return sock.sendMessage(from, { text: "❌ Gagal download media." }); }
            }
        }

        if (!rawInput && !hasMedia) return sock.sendMessage(from, { text: "⚠️ Masukkan instruksi atau foto soal." });
        if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI mati." });

        try {
            // --- 2. CEK KELAS ---
            const kelas = await db.prisma.class.findFirst({ where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }, include: { semesters: { where: { isActive: true }, include: { subjects: { orderBy: { name: 'asc' } } } } } });
            if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum siap." });

            await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

            // --- 3. CONTEXT INJECTION ---
            const subjectsList = kelas.semesters[0].subjects.map(s => s.name).join(", ");
            const pendingTasks = await db.prisma.task.findMany({ where: { classId: kelas.id, status: 'Pending' }, take: 30 });

            // Context diperjelas agar AI bisa mapping "litdig" -> "Literasi Digital"
            const taskContext = pendingTasks.map(t => `ID:${t.id} | Mapel:${t.mapel} | Judul:"${t.judul}"`).join("\n");

            const now = new Date();
            const fmtDate = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            const todayStr = fmtDate(now);
            const besokStr = fmtDate(new Date(now.setDate(now.getDate() + 1)));
            const lusaStr = fmtDate(new Date(now.setDate(now.getDate() + 1)));

            const systemPrompt = `
      Peran: Task Manager.
      WAKTU: ${todayStr}. BESOK: ${besokStr}. LUSA: ${lusaStr}.
      
      MAPEL VALID: [${subjectsList}]
      
      TUGAS PENDING (TARGET OPERASI): 
      ${taskContext}

      TUGAS: Analisis input user -> Tentukan aksi (ADD, DELETE, DELETE_ALL, DONE, EDIT).

      ATURAN KHUSUS:
      1. "delete_all": Jika user bilang "hapus semua". Output: [{ "action": "delete_all" }]
      
      2. "edit": Bisa ubah JUDUL, DEADLINE, atau LINK.
         - Field 'target' WAJIB persis dengan salah satu Nama Mapel atau Judul di list "TUGAS PENDING".
         - JANGAN gunakan singkatan user. Contoh: User bilang "litdig", tapi di list adanya "Literasi Digital", maka target="Literasi Digital".
      
      3. "add":
         - Field 'mapel' harus mirip MAPEL VALID.
         - 'deadline' WAJIB (YYYY-MM-DD HH:mm). Default 23:59.

      OUTPUT JSON Array:
      [ { "action": "edit", "target": "Literasi Digital", "link": "https://youtube.com" } ]
      `;


            // --- 4. EXECUTE AI (Refactored) ---
            const { generateAIContent } = require('../../utils/aiHandler');

            let mediaPayload = null;
            if (mediaPart) {
                mediaPayload = {
                    buffer: Buffer.from(mediaPart.inlineData.data, 'base64'),
                    mimeType: mediaPart.inlineData.mimeType
                };
            }

            let actionsList = [];
            try {
                const result = await generateAIContent(model, systemPrompt, `TARGET TASKS:\n${taskContext}\n\nMAPEL: ${subjectsList}\nWAKTU: ${todayStr}`, rawInput, mediaPayload);
                if (Array.isArray(result)) {
                    actionsList = result;
                } else if (result) {
                    actionsList = [result]; // Handle single object return
                }
            } catch (e) {
                console.error("AI Handler Error:", e);
                return sock.sendMessage(from, { text: "❌ AI gagal memproses permintaan." });
            }

            if (!actionsList || actionsList.length === 0) return sock.sendMessage(from, { text: "⚠️ AI tidak menemukan instruksi yang jelas." });

            let report = { add: [], done: [], delete: [], edit: [], errors: [] };

            // --- 5. EXECUTE DB ---
            for (const item of actionsList) {
                try {
                    // === DELETE ALL ===
                    if (item.action === 'delete_all') {
                        const allTasks = await db.prisma.task.findMany({ where: { classId: kelas.id } });
                        let fileCount = 0;
                        allTasks.forEach(t => {
                            if (t.attachmentData) {
                                try {
                                    const fPath = JSON.parse(t.attachmentData).localFilePath;
                                    if (fs.existsSync(fPath)) { fs.unlinkSync(fPath); fileCount++; }
                                } catch (e) { }
                            }
                        });
                        const deleted = await db.prisma.task.deleteMany({ where: { classId: kelas.id } });
                        report.delete.push(`SEMUA TUGAS (${deleted.count} item)`);
                        break;
                    }

                    // === ADD ===
                    else if (item.action === 'add' && item.mapel) {
                        const validMapel = kelas.semesters[0].subjects.find(s => s.name.toLowerCase().includes(item.mapel.toLowerCase()));
                        const deadlineDate = parseWIB(item.deadline);

                        if (validMapel && deadlineDate) {
                            const finalJudul = (item.judul && item.judul.trim().length > 0 && item.judul !== '-') ? item.judul : `Tugas ${validMapel.name}`;
                            await db.prisma.task.create({
                                data: {
                                    classId: kelas.id,
                                    mapel: validMapel.name,
                                    judul: finalJudul,
                                    deadline: deadlineDate,
                                    attachmentData: attachData,
                                    isGroupTask: !!item.isGroup,
                                    link: item.link || "-"
                                }
                            });
                            const dlStr = deadlineDate.toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                            report.add.push(`${finalJudul} (${validMapel.name}, DL: ${dlStr})`);
                        } else {
                            if (!validMapel) report.errors.push(`Mapel "${item.mapel}" tdk valid`);
                            if (!deadlineDate) report.errors.push(`Format tgl salah`);
                        }
                    }

                    // === DELETE / DONE / EDIT ===
                    else {
                        // Safe string
                        const rawTarget = item.target || item.mapel || item.judul;
                        if (!rawTarget) continue;
                        const searchKey = String(rawTarget).toLowerCase().trim();
                        let target = null;

                        // A. Cari by ID
                        if (/^\d+$/.test(searchKey)) {
                            const searchId = parseInt(searchKey);
                            target = pendingTasks.find(t => t.id === searchId);
                        }

                        // B. Cari by Mapel/Judul (Fuzzy Include)
                        if (!target) {
                            target = pendingTasks.find(t =>
                                (t.mapel && t.mapel.toLowerCase().includes(searchKey)) ||
                                (t.judul && t.judul.toLowerCase().includes(searchKey))
                            );
                        }

                        if (target) {
                            if (item.action === 'delete') {
                                await db.prisma.task.delete({ where: { id: target.id } });
                                if (target.attachmentData) { try { fs.unlinkSync(JSON.parse(target.attachmentData).localFilePath) } catch (e) { } }
                                report.delete.push(target.judul);
                            }
                            if (item.action === 'done') {
                                await db.prisma.task.update({ where: { id: target.id }, data: { status: 'Selesai' } });
                                report.done.push(target.judul);
                            }
                            // === MODIFIKASI BAGIAN EDIT ===
                            if (item.action === 'edit') {
                                let updateData = {};
                                let isDeadlineChanged = false; // Flag untuk cek perubahan waktu

                                if (item.judul) updateData.judul = item.judul;
                                if (item.link) updateData.link = item.link;

                                // Cek jika ada input deadline baru
                                if (item.deadline) {
                                    const newDate = parseWIB(item.deadline);
                                    if (newDate) {
                                        updateData.deadline = newDate;
                                        isDeadlineChanged = true;
                                    }
                                }

                                if (Object.keys(updateData).length > 0) {
                                    // 1. LOGIKA RESET REMINDER
                                    // Jika deadline berubah, hapus semua status reminder lama agar cronjob bisa kirim ulang sesuai jadwal baru
                                    if (isDeadlineChanged) {
                                        await db.prisma.taskReminderStatus.deleteMany({
                                            where: { taskId: target.id }
                                        });
                                    }

                                    // 2. Update Data Task Utama
                                    await db.prisma.task.update({ where: { id: target.id }, data: updateData });

                                    // 3. Susun Log Laporan
                                    let log = target.judul;
                                    if (updateData.link) log += ` (Link Diupdate)`;

                                    // Tambahkan notifikasi visual bahwa pengingat direset
                                    if (isDeadlineChanged) log += ` (Waktu Diupdate & 🔔 Reminder Direset)`;

                                    report.edit.push(log);
                                }
                            }
                            // === END MODIFIKASI ===
                        } else {
                            report.errors.push(`${item.action}: "${searchKey}" tdk ketemu.`);
                        }
                    }
                } catch (e) { console.error(e); report.errors.push(`Err System`); }
            }

            let reply = `🤖 *LAPORAN OTOMATIS TUGAS*\n──────────────────────\n🏫 Kelas: ${kelas.name}\n\n`;
            let hasChange = false;

            if (report.add.length) { reply += `✅ *Tugas Baru:*\n` + report.add.map(s => `• ${s}`).join('\n') + `\n\n`; hasChange = true; }
            if (report.done.length) { reply += `🎉 *Selesai:*\n` + report.done.map(s => `• ~${s}~\n`).join('\n') + `\n\n`; hasChange = true; }
            if (report.edit.length) { reply += `✏️ *Diupdate:*\n` + report.edit.map(s => `• ${s}`).join('\n') + `\n\n`; hasChange = true; }
            if (report.delete.length) { reply += `🗑️ *Dihapus:*\n` + report.delete.map(s => `• ~${s}~`).join('\n') + `\n\n`; hasChange = true; }

            if (!hasChange && report.errors.length === 0) reply += `⚠️ Tidak ada perubahan data.\n`;
            if (report.errors.length) reply += `⛔ *Log Error:*\n` + report.errors.slice(0, 5).map(e => `• ${e}`).join('\n');

            if (attachData && report.add.length > 0) reply += `\n📎 _Lampiran File Berhasil Disimpan_`;
            if (hasChange) reply += `\n──────────────────\n💡 _Cek detail: #task-list_`;

            await sock.sendMessage(from, { text: reply, mentions: [sender] });

        } catch (e) {
            console.error("Error task-ai:", e);
            await sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem." });
        }
    }
};