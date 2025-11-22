require("dotenv").config();

module.exports = {
  botName: "Ketua Kelas 🤖",
  ownerNumber: process.env.OWNER_NUMBER,
  sessionName: "auth_info_baileys",
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    modelName: "gemini-2.5-flash",
    systemInstruction: `Kamu adalah Ketua Kelas, asisten grup WhatsApp yang pintar, santai, dan membantu. Tugasmu mencatat tugas, mengingatkan jadwal, dan menghibur member. Gunakan bahasa gaul Indonesia yang sopan.`,
  },

  vipTriggerId: "276252363632838",
  timezone: "Asia/Jakarta",

  msg: {
    wait: "⏳ _Sebentar, lagi diproses..._",
    success: "✅ _Berhasil!_",
    error: "❌ _Terjadi kesalahan sistem._",
    onlyGroup: "⚠️ _Fitur ini hanya untuk grup._",
    onlyAdmin: "⚠️ _Fitur ini khusus Admin._",
  }
};