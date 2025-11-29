// src/commands/utility/hidetag.js
module.exports = {
  name: "#hide-tag",
  description: "Tag member dengan opsi filter. Gunakan --except atau --only.",
  execute: async (bot, from, sender, args, msg, text) => {
    const { sock, owner } = bot;

    if (!from.endsWith("@g.us")) {
      return sock.sendMessage(from, { text: "❌ Perintah ini hanya untuk grup." });
    }

    // --- 1. Validasi Admin/Owner ---
    let metadata;
    try {
        metadata = await sock.groupMetadata(from);
    } catch (err) {
        return sock.sendMessage(from, { text: "❌ Gagal memuat info grup." });
    }

    // Cek apakah sender adalah Owner atau Admin
    const isOwner = sender.includes(owner) || sender === owner; // Support format string/array
    const participant = metadata.participants.find((p) => p.id === sender);
    const isAdmin = participant?.admin === "admin" || participant?.admin === "superadmin";

    if (!isOwner && !isAdmin) {
      return sock.sendMessage(from, { text: "⚠️ Hanya Admin yang boleh menggunakan fitur ini." });
    }

    try {
        // --- 2. Persiapan Data ---
        const allMembers = metadata.participants.map(p => p.id);
        
        // Ambil JID yang di-mention secara native (biru) oleh user
        // Ini lebih akurat daripada parsing teks manual
        const nativeMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        // Gabungkan argumen teks
        let fullText = args.join(" ");
        let finalMentions = [];
        let displayMessage = fullText; 

        // Helper: Ekstrak nomor dari teks (Backup jika native mention kosong)
        const extractJidsFromText = (segment) => {
            const matches = segment.match(/(\d{7,15})/g) || [];
            return matches.map(num => num.includes('@s.whatsapp.net') ? num : `${num}@s.whatsapp.net`);
        };

        // --- 3. Logika Filter ---

        // SKENARIO A: --only (Hanya tag orang tertentu)
        if (fullText.includes("--only")) {
            const parts = fullText.split("--only");
            displayMessage = parts[0].trim(); // Pesan sebelum flag
            const targetSegment = parts[1];   // Teks setelah flag
            
            // 1. Prioritas: Gunakan Native Mention jika ada
            if (nativeMentions.length > 0) {
                finalMentions = nativeMentions;
            } 
            // 2. Fallback: Parsing teks manual (misal user copas nomor)
            else {
                const textTargets = extractJidsFromText(targetSegment);
                // Validasi: Pastikan target ada di grup ini
                finalMentions = textTargets.filter(id => allMembers.includes(id));
            }

            if (finalMentions.length === 0) {
                return sock.sendMessage(from, { 
                    text: "⚠️ Tidak ada target valid.\nPastikan nomor yang di-tag adalah anggota grup ini." 
                });
            }

        // SKENARIO B: --except (Tag semua KECUALI...)
        } else if (fullText.includes("--except")) {
            const parts = fullText.split("--except");
            displayMessage = parts[0].trim();
            
            let excluded = [];
            if (nativeMentions.length > 0) {
                excluded = nativeMentions;
            } else {
                excluded = extractJidsFromText(parts[1]);
            }
            
            // Filter: Semua member KECUALI yang ada di list excluded
            finalMentions = allMembers.filter(id => !excluded.includes(id));

        // SKENARIO C: Default (Tag Semua)
        } else {
            finalMentions = allMembers;
        }

        // Fallback pesan kosong
        if (!displayMessage) displayMessage = "📣 *PENGUMUMAN PENTING*";

        // --- 4. Eksekusi Kirim ---
        await sock.sendMessage(from, {
            text: displayMessage,
            mentions: finalMentions
        });

    } catch (err) {
      console.error("Error #hidetag:", err);
      await sock.sendMessage(from, { text: "❌ Gagal melakukan tagging." });
    }
  },
};