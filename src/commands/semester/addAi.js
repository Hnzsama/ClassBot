// commands/semester/create-ai.js
module.exports = {
  name: "#add-semester-ai",
  description: "Buat semester sekuensial ('Semester 1', 'Semester 2', dst). Format: #add-semester-ai [Angka Terakhir]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    const rawInput = args.join(' ').trim();
    let targetNumber = parseInt(args[0]);
    
    // --- 1. AI Parsing (Jika input bukan angka) ---
    if (isNaN(targetNumber)) {
        
        if (!bot.model) {
             return bot.sock.sendMessage(from, { text: "❌ Fitur AI tidak aktif. Masukkan angka langsung (misal: 8)." });
        }
        
        await bot.sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

        const prompt = `
        Tugas Anda adalah mengkonversi input user menjadi SATU ANGKA NUMERIK.
        Input user: "${rawInput}".
        
        Jika user meminta 'semua' atau 'total', berikan angka 8 (asumsi standar S1).
        Outputkan HANYA SATU ANGKA, tanpa teks tambahan, simbol, atau penjelasan.
        `;

        try {
             const result = await bot.model.generateContent(prompt);
             // FIX: Panggil .text() untuk mendapatkan string
             const aiResponseText = result.response.text(); 
             const aiResponseMatch = aiResponseText.trim().match(/\d+/);
             
             if (aiResponseMatch) {
                 targetNumber = parseInt(aiResponseMatch[0]);
             } else {
                 return bot.sock.sendMessage(from, { text: "❌ AI gagal mengkonversi input. Masukkan angka langsung (misal: 8)." });
             }
        } catch (e) {
             console.error("Gemini Failure in Semester AI:", e);
             return bot.sock.sendMessage(from, { text: "❌ Gagal menghubungi AI. Masukkan angka langsung." });
        }
    }
    
    // 2. Validasi Angka (Wajib)
    if (isNaN(targetNumber) || targetNumber <= 0 || targetNumber > 14) {
      return bot.sock.sendMessage(from, { text: "⚠️ Masukkan angka semester terakhir yang ingin dibuat (misal: 7). Maksimal 14." });
    }

    try {
      // FIX: Gunakan Dual Group Check untuk menemukan konteks Kelas
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 3. Cari Max Semester yang Sudah Ada
      const existingSems = await bot.db.prisma.semester.findMany({ 
        where: { classId: kelas.id },
        select: { name: true }
      });

      let maxSemNumber = 0;
      existingSems.forEach(s => {
          const match = s.name.match(/semester\s*(\d+)/i);
          if (match && match[1]) {
              const num = parseInt(match[1]);
              if (num > maxSemNumber) maxSemNumber = num;
          }
      });

      const startSem = maxSemNumber + 1;
      
      if (targetNumber <= maxSemNumber) {
           return bot.sock.sendMessage(from, { 
             text: `⚠️ Semua semester hingga Semester ${maxSemNumber} sudah ada. Tidak ada yang perlu dibuat.` 
           });
      }
      
      // 4. Buat Payload Semester Baru
      const newSemestersPayload = [];
      const createdNames = [];
      for (let i = startSem; i <= targetNumber; i++) {
        const newName = `Semester ${i}`;
        newSemestersPayload.push({
            name: newName,
            classId: kelas.id,
            isActive: false 
        });
        createdNames.push(newName);
      }

      // 5. Eksekusi Create Many
      if (newSemestersPayload.length > 0) {
          const result = await bot.db.prisma.semester.createMany({
              data: newSemestersPayload,
          });
          
          let responseText = `✨ *${result.count} Semester Baru Berhasil Dibuat!* ✨\n`;
          responseText += `Untuk Kelas: *${kelas.name}*\n\n`;
          responseText += `Dibuat: *${createdNames[0]}* hingga *${createdNames[createdNames.length - 1]}*\n\n`;
          responseText += `Oleh: @${sender.split("@")[0]}`;

          await bot.sock.sendMessage(from, {
              text: responseText,
              mentions: [sender]
          });
      } else {
          await bot.sock.sendMessage(from, { text: `❌ Gagal membuat semester baru. Tidak ada rentang yang valid.` });
      }

    } catch (e) {
      console.error("Error create-semesters:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal membuat semester baru secara sekuensial." });
    }
  }
};