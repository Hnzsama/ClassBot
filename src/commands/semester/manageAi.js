const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Helper: Title Case
function toTitleCase(str) {
    if (!str) return "";
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

module.exports = {
  name: "#semester-ai",
  description: "Kelola Semester (Add/Edit/Aktifkan/Delete) via AI.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, model, db } = bot;
    if (!from.endsWith("@g.us")) return;
    
    let rawInput = text.replace("#semester-ai", "").trim();
    
    // --- 1. DETEKSI MEDIA ---
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let mediaPart = null; let hasMedia = false;

    if (quotedMsg && quotedMsg.imageMessage) {
        try {
            const buffer = await downloadMediaMessage(
                { key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
                'buffer',
                {},
            );
            mediaPart = { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } };
            hasMedia = true;
        } catch (e) {
            console.error("Gagal download gambar:", e);
        }
    }

    if (!rawInput && !hasMedia) return sock.sendMessage(from, { text: "⚠️ Masukkan instruksi." });
    if (!model) return sock.sendMessage(from, { text: "❌ Fitur AI mati." });

    try {
      const kelas = await db.prisma.class.findFirst({ where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } });
      if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

      // --- 2. CONTEXT INJECTION ---
      const existingSems = await db.prisma.semester.findMany({ where: { classId: kelas.id } });
      const contextStr = existingSems.map(s => `${s.name} ${s.isActive ? '(AKTIF)' : ''}`).join(", ") || "Belum ada semester";

      // --- 3. PROMPT AI CERDAS ---
      const systemPrompt = `
      Peran: Academic Admin.
      DATA SEMESTER SAAT INI: [ ${contextStr} ]
      
      TUGAS: Tentukan aksi (ADD, EDIT, ACTIVATE, DELETE).

      LOGIKA KHUSUS:
      1. "add": Jika user minta range (misal "Buat semester 1 sampai 5"), outputkan array objek ADD sebanyak jumlah tersebut.
      2. "activate": Aktifkan semester (Hanya boleh 1 yang aktif).
      3. "edit": Ganti nama semester.
      4. "delete": Hapus semester.

      ATURAN TARGET:
      - "target": Nama semester lama (cari yang mirip di DATA SAAT INI).
      - "newName": Nama baru (Format Title Case, misal "Semester 1").

      OUTPUT JSON Array:
      [
        { "action": "add", "newName": "Semester 1" },
        { "action": "add", "newName": "Semester 2" },
        { "action": "activate", "target": "Semester 1" }
      ]
      `;

      let parts = [systemPrompt];
      if (hasMedia) { parts.push({ text: `Input Tambahan: "${rawInput}"` }); parts.push(mediaPart); }
      else { parts.push({ text: `Input User: "${rawInput}"` }); }

      // --- 4. EXECUTE AI ---
      const result = await model.generateContent(parts);
      let actionsList = [];
      try {
        const jsonMatch = result.response.text().match(/\[.*?\]/s);
        if (!jsonMatch) throw new Error();
        actionsList = JSON.parse(jsonMatch[0]);
      } catch (e) { return sock.sendMessage(from, { text: "❌ AI bingung. Coba instruksi lebih sederhana." }); }

      // --- 5. EXECUTE DB ---
      let report = { add: [], active: [], edit: [], del: [], errors: [] };

      for (const item of actionsList) {
          try {
              // === ADD ===
              if (item.action === 'add' && item.newName) {
                  const fName = toTitleCase(item.newName);
                  // Cek duplikat di array lokal (karena DB belum tentu update instan di loop)
                  const exist = existingSems.find(s => s.name.toLowerCase() === fName.toLowerCase());
                  
                  if (!exist) {
                      const created = await db.prisma.semester.create({ 
                          data: { classId: kelas.id, name: fName, isActive: false } 
                      });
                      existingSems.push(created); // Update konteks lokal
                      report.add.push(fName);
                  }
              } 
              
              // === ACTIVATE ===
              else if (item.action === 'activate' && item.target) {
                  const target = existingSems.find(s => s.name.toLowerCase().includes(item.target.toLowerCase()));
                  if (target) {
                      await db.prisma.$transaction([
                          db.prisma.semester.updateMany({ where: { classId: kelas.id }, data: { isActive: false } }),
                          db.prisma.semester.update({ where: { id: target.id }, data: { isActive: true } })
                      ]);
                      // Update lokal
                      existingSems.forEach(s => s.isActive = false);
                      target.isActive = true;
                      
                      report.active.push(target.name);
                  } else report.errors.push(`Aktifkan: "${item.target}" tdk ketemu`);
              } 
              
              // === EDIT ===
              else if (item.action === 'edit' && item.target && item.newName) {
                  const target = existingSems.find(s => s.name.toLowerCase().includes(item.target.toLowerCase()));
                  if (target) {
                      const fNew = toTitleCase(item.newName);
                      await db.prisma.semester.update({ where: { id: target.id }, data: { name: fNew } });
                      report.edit.push(`${target.name} ➔ ${fNew}`);
                      target.name = fNew; // Update lokal
                  } else report.errors.push(`Edit: "${item.target}" tdk ketemu`);
              }

              // === DELETE ===
              else if (item.action === 'delete' && item.target) {
                  const target = existingSems.find(s => s.name.toLowerCase().includes(item.target.toLowerCase()));
                  if (target) {
                      if (target.isActive) {
                          report.errors.push(`Hapus: "${target.name}" gagal (Sedang AKTIF)`);
                      } else {
                          await db.prisma.semester.delete({ where: { id: target.id } });
                          const idx = existingSems.indexOf(target);
                          if (idx > -1) existingSems.splice(idx, 1);
                          report.del.push(target.name);
                      }
                  } else report.errors.push(`Hapus: "${item.target}" tdk ketemu`);
              }

          } catch (e) { console.error(e); }
      }

      // --- 6. LAPORAN KEREN ---
      let reply = `🤖 *LAPORAN AI SEMESTER*\n`;
      reply += `──────────────────────\n`;
      reply += `🏫 Kelas: ${kelas.name}\n\n`;
      
      let hasChange = false;

      if (report.add.length) {
          reply += `✅ *Dibuat (${report.add.length}):*\n`;
          // Rangkum jika banyak
          if (report.add.length > 5) reply += `• ${report.add[0]} s/d ${report.add[report.add.length-1]}\n\n`;
          else reply += report.add.map(s=>`• ${s}`).join('\n') + `\n\n`;
          hasChange = true;
      }

      if (report.active.length) {
          reply += `🟢 *Diaktifkan:*\n` + report.active.map(s=>`• ${s}`).join('\n') + `\n\n`;
          hasChange = true;
      }

      if (report.edit.length) {
          reply += `✏️ *Diedit:*\n` + report.edit.map(s=>`• ${s}`).join('\n') + `\n\n`;
          hasChange = true;
      }

      if (report.del.length) {
          reply += `🗑️ *Dihapus:*\n` + report.del.map(s=>`• ~${s}~`).join('\n') + `\n\n`;
          hasChange = true;
      }
      
      if (!hasChange) reply += `⚠️ Tidak ada perubahan.\n`;
      if (report.errors.length) reply += `⛔ *Log:* ${report.errors.join(', ')}`;

      reply += `──────────────────────\n`;
      reply += `💡 _Cek hasil: #list-semester_`;

      await sock.sendMessage(from, { text: reply, mentions: [sender] });

    } catch (e) { console.error(e); }
  }
};