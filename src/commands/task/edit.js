module.exports = {
  name: "#edit-task",
  description: "Edit tugas. Format: #edit-task [ID] [judul/deadline/status/link] [Value]",
  execute: async (bot, from, sender, args, msg, text) => {
    if (!from.endsWith("@g.us")) return;
    
    // 1. Validasi Input
    if (args.length < 3) {
        return bot.sock.sendMessage(from, { 
            text: "⚠️ Format Salah!\n\nContoh:\n`#edit-task 15 judul Makalah Sejarah`\n`#edit-task 15 deadline 2025-12-31`\n`#edit-task 15 status Selesai`\n`#edit-task 15 link google.com`" 
        });
    }

    // 2. Parse ID ke Integer (WAJIB karena sekarang ID bukan UUID lagi)
    const taskId = parseInt(args[0]);
    if (isNaN(taskId)) {
        return bot.sock.sendMessage(from, { text: "❌ ID harus berupa angka." });
    }

    const field = args[1].toLowerCase();
    const newValue = args.slice(2).join(" ");

    // 3. Validasi Field yang boleh diedit
    if (!["judul", "deadline", "status", "link"].includes(field)) {
        return bot.sock.sendMessage(from, { text: "❌ Field salah. Pilih: judul, deadline, status, atau link." });
    }

    try {
        // 4. Cek Task & Validasi Grup
        const task = await bot.db.prisma.task.findFirst({
            where: { 
                id: taskId,
                class: { groupId: from } 
            }
        });

        if (!task) return bot.sock.sendMessage(from, { text: "❌ Tugas tidak ditemukan di kelas ini." });

        // 5. Logic Update Berdasarkan Field
        let updateData = {};
        let displayValue = newValue;

        if (field === "deadline") {
            const date = new Date(newValue);
            if (isNaN(date.getTime())) return bot.sock.sendMessage(from, { text: "❌ Format tanggal salah (YYYY-MM-DD)." });
            updateData.deadline = date;
            displayValue = date.toLocaleDateString("id-ID");
        
        } else if (field === "status") {
            // Normalisasi status biar rapi
            const lowerVal = newValue.toLowerCase();
            if (["done", "selesai", "sudah"].includes(lowerVal)) {
                updateData.status = "Selesai";
            } else if (["pending", "belum"].includes(lowerVal)) {
                updateData.status = "Pending";
            } else {
                return bot.sock.sendMessage(from, { text: "❌ Status hanya: 'Pending' atau 'Selesai'." });
            }
            displayValue = updateData.status;
        
        } else {
            // Judul & Link
            updateData[field] = newValue;
        }

        // 6. Eksekusi Update
        await bot.db.prisma.task.update({
            where: { id: taskId },
            data: updateData
        });

        // 7. Kirim Info & TAG PELAKU
        await bot.sock.sendMessage(from, {
            text: `✏️ *TUGAS DIUPDATE*\n\n📚 Mapel: ${task.mapel}\n🔧 Bagian: ${field.toUpperCase()}\n📝 Menjadi: *${displayValue}*\n\nDiupdate oleh: @${sender.split("@")[0]}`,
            mentions: [sender]
        });

    } catch (e) {
        console.error(e);
        await bot.sock.sendMessage(from, { text: "❌ Gagal update tugas." });
    }
  }
};