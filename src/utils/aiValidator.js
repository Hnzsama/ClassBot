// src/utils/aiValidator.js

async function validateTaskEvidence(model, imageBuffer, userCaption, pendingTasksList) {
    if (!model) return { status: 'error', reason: "AI mati." };

    // Format daftar tugas agar bisa dibaca AI
    const tasksContext = pendingTasksList.map(t => 
        `- ID: ${t.id} | Mapel: ${t.mapel} | Judul: ${t.judul}`
    ).join("\n");

    const prompt = `
    Anda adalah Asisten Dosen. 
    
    DATA TUGAS PENDING DI KELAS:
    ${tasksContext}

    INPUT MAHASISWA: "${userCaption}"
    
    TUGAS ANDA:
    1. **Identifikasi Tugas:** Cari tugas mana yang dimaksud mahasiswa berdasarkan INPUT.
       - Cocokkan singkatan (misal: "Alpro" = "Algoritma", "MPB" = "Manajemen Proses").
       - Jika input tidak menyebutkan Mapel DAN Judul secara spesifik (ambigu), kembalikan taskId: null.
    
    2. **Validasi Gambar:** (Hanya jika Tugas ditemukan)
       - Lihat gambar yang dilampirkan.
       - Apakah gambar tersebut masuk akal sebagai bukti pengerjaan untuk tugas tersebut?
       - (Misal: Tugas Coding -> Gambar Laptop/Kode. Tugas Tulis -> Kertas).
       - Tolak jika gambar gelap, selfie, atau tidak relevan.

    OUTPUT JSON (Wajib):
    {
      "taskId": number | null,  // ID tugas yang cocok, atau null jika tidak ketemu/ambigu
      "isValid": boolean,       // Apakah gambar valid?
      "reason": "Alasan singkat untuk mahasiswa (Bahasa Indonesia)"
    }
    `;

    try {
        const imagePart = {
            inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: "image/jpeg",
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        let jsonText = result.response.text().trim().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("[AI Validator] Error:", e);
        return { taskId: null, isValid: false, reason: "Gagal memproses AI." };
    }
}

module.exports = { validateTaskEvidence };