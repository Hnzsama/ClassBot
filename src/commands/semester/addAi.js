// src/commands/semester/create-ai.js
module.exports = {
  name: "#add-semester-ai",
  description: "Buat semester otomatis. Format: #add-semester-ai [Angka Terakhir]",
  execute: async (bot, from, sender, args, msg) => {
    if (!from.endsWith("@g.us")) return;

    const rawInput = args.join(' ').trim();
    let targetNumber = parseInt(args[0]);
    
    // --- 1. AI Parsing (Jika input user "delapan", "sampai 8", dll) ---
    if (isNaN(targetNumber)) {
        if (!bot.model) {
             return bot.sock.sendMessage(from, { text: "⚠️ Fitur AI mati. Masukkan angka langsung (misal: 8)." });
        }
        
        await bot.sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

        const prompt = `
        Tugas: Konversi input user menjadi SATU ANGKA NUMERIK.
        Input: "${rawInput}".
        Context: User ingin membuat semester kuliah. 
        Jika user bilang 'lulus', 'wisuda', 'sarjana', jawab 8.
        Output: HANYA ANGKA.
        `;

        try {
             const result = await bot.model.generateContent(prompt);
             const aiResponseText = result.response.text(); 
             const aiResponseMatch = aiResponseText.trim().match(/\d+/);
             
             if (aiResponseMatch) {
                 targetNumber = parseInt(aiResponseMatch[0]);
             } else {
                 return bot.sock.sendMessage(from, { text: "❌ AI bingung. Ketik angka langsung (contoh: `#add-semester-ai 8`)." });
             }
        } catch (e) {
             console.error("Gemini Error:", e);
             return bot.sock.sendMessage(from, { text: "❌ Gagal koneksi AI." });
        }
    }
    
    // 2. Validasi Angka
    if (isNaN(targetNumber) || targetNumber <= 0 || targetNumber > 14) {
      return bot.sock.sendMessage(from, { text: "⚠️ Masukkan angka semester terakhir (Maksimal 14)." });
    }

    try {
      // 3. Cek Kelas
      const kelas = await bot.db.prisma.class.findFirst({ 
          where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] } 
      });
      if (!kelas) return bot.sock.sendMessage(from, { text: "❌ Kelas belum terdaftar." });

      // 4. Cek Max Semester Existing
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
             text: `⚠️ *DATA SUDAH ADA*\nSemester 1 sampai Semester ${maxSemNumber} sudah tersedia di kelas ini.` 
           });
      }
      
      // 5. Buat Payload
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

      // 6. Eksekusi & Respon Keren
      if (newSemestersPayload.length > 0) {
          const result = await bot.db.prisma.semester.createMany({
              data: newSemestersPayload,
          });
          
          let reply = `✨ *GENERATOR SEMESTER SELESAI*\n`;
          reply += `──────────────────────\n`;
          reply += `🏫 Kelas: ${kelas.name}\n`;
          reply += `📊 Status: ${result.count} Semester dibuat\n`;
          reply += `──────────────────────\n`;
          reply += `✅ *Rentang Ditambahkan:*\n`;
          reply += `   ${createdNames[0]} ➔ ${createdNames[createdNames.length - 1]}\n\n`;
          reply += `💡 _Gunakan #list-semester untuk melihat detail._`;

          await bot.sock.sendMessage(from, {
              text: reply,
              mentions: [sender]
          });
      }

    } catch (e) {
      console.error("Error create-semesters:", e);
      await bot.sock.sendMessage(from, { text: "❌ Gagal membuat semester baru." });
    }
  }
};