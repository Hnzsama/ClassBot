// src/commands/reminder/list.js
module.exports = {
  name: "#reminder-list",
  description: "Show active reminders.",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    try {
      // 1. Cek Validasi Kelas
      const kelas = await bot.db.prisma.class.findFirst({
        where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
      });

      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Grup ini belum terdaftar sebagai kelas." });

      // 2. Ambil reminder
      const reminders = await bot.db.prisma.reminder.findMany({
        where: { classId: kelas.id, isSent: false },
        orderBy: { waktu: 'asc' }
      });

      if (reminders.length === 0) {
        return bot.sock.sendMessage(from, {
          text: "🔕 *TIDAK ADA PENGINGAT*\n\nJadwal kosong. Gunakan `#reminder` atau `#reminder-ai` untuk menambah."
        });
      }

      // --- NEW LOGIC: AMBIL DATA MEMBER GRUP ASLI ---
      let groupParticipants = [];
      try {
        const metadata = await bot.sock.groupMetadata(from);
        groupParticipants = metadata.participants; // Isinya [{ id: '628xx@s.wa.net', admin: null }, ...]
      } catch (err) {
        console.log("[DEBUG] Gagal ambil metadata grup, fallback ke logic biasa.");
      }

      // 3. Susun Pesan
      let text = `🔔 *JADWAL PENGINGAT KELAS*\n`;
      text += `🏫 ${kelas.name}\n`;
      text += `📊 Total: ${reminders.length} antrean\n`;
      text += `──────────────────────\n`;

      const mentionsToTag = [];

      reminders.forEach((r) => {
        // Format Waktu
        const dateStr = new Date(r.waktu).toLocaleDateString("id-ID", {
          weekday: 'long', day: 'numeric', month: 'short', timeZone: "Asia/Jakarta"
        });
        const timeStr = new Date(r.waktu).toLocaleTimeString("id-ID", {
          hour: '2-digit', minute: '2-digit', timeZone: "Asia/Jakarta"
        });

        const isRecurring = !!r.repeatInterval;
        const iconStatus = isRecurring ? "🔄" : "🕐";
        const repeatInfo = isRecurring ? `_(Tiap ${r.repeatInterval})_` : "";

        // --- LOGIKA PENCOCOKAN (MATCHING) ---
        let senderDisplay = "Admin";
        const rawSender = r.sender ? String(r.sender) : "";

        // 1. Bersihkan dulu data dari DB (ambil angkanya doang)
        // Misal DB: "+27 625..." -> Jadi "27625..."
        const dbNumberOnly = rawSender.replace(/\D/g, "");

        // 2. CARI DI LIST MEMBER GRUP
        // Kita cari member yang ID-nya (JID) DIAWALI dengan nomor dari DB
        let matchedMember = null;
        if (dbNumberOnly.length > 5) {
          matchedMember = groupParticipants.find(p => p.id.startsWith(dbNumberOnly));
        }

        if (matchedMember) {
          // KASUS 1: KETEMU! Usernya memang ada di grup.
          // Kita pakai ID asli dari WhatsApp, bukan rakitan sendiri.
          senderDisplay = `@${matchedMember.id.split('@')[0]}`;
          mentionsToTag.push(matchedMember.id);
          console.log(`[DEBUG MATCH] DB: ${rawSender} -> FOUND: ${matchedMember.id}`);
        } else if (dbNumberOnly.length > 5) {
          // KASUS 2: TIDAK KETEMU (Mungkin user sudah keluar grup/Left)
          // Terpaksa kita rakit manual biar tetap tampil nomornya
          senderDisplay = `@${dbNumberOnly}`;
          // Tetap kita coba tag, siapa tau cuma glitch metadata
          mentionsToTag.push(`${dbNumberOnly}@s.whatsapp.net`);
          console.log(`[DEBUG MATCH] DB: ${rawSender} -> NOT FOUND (User left?), Manual tag.`);
        } else {
          // KASUS 3: Data DB ngaco/pendek/bukan angka
          senderDisplay = rawSender || "Admin";
        }
        // -------------------------------------

        text += `🆔 ID: \`${r.id}\` ${iconStatus}\n`;
        text += `📅 *${dateStr} • Pukul ${timeStr} WIB*\n`;
        text += `📝 "${r.pesan}"\n`;
        if (isRecurring) text += `${repeatInfo}\n`;
        text += `👤 Oleh: ${senderDisplay}\n`;
        text += `──────────────────────\n`;
      });

      text += `💡 *Kelola Reminder:*\n`;
      text += `• Hapus: \`#reminder-del [ID]\``;

      // Hapus duplikat mention
      const uniqueMentions = [...new Set(mentionsToTag)];

      await bot.sock.sendMessage(from, {
        text,
        mentions: uniqueMentions
      });

    } catch (e) {
      console.error("Error list-reminder:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal memuat daftar pengingat." });
    }
  }
};