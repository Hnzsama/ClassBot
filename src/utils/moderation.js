// src/utils/moderation.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const BAD_WORDS_LIST = require('../data/badwords.json');
const TOXIC_REGEX = new RegExp(`\\b(${BAD_WORDS_LIST.join('|')})\\b`, 'i');


async function checkContent(bot, msg, text, sender) {
    const { model, sock } = bot;

    // --- LAYER 1: TEXT ---
    if (text) {
        const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        const matchOriginal = TOXIC_REGEX.test(text);
        const matchClean = TOXIC_REGEX.test(cleanText);

        if (matchOriginal || matchClean) {
            return { isSafe: false, reason: "Terdeteksi kata kasar/toxic (Auto Filter)" };
        }
    }

    // --- LAYER 2: MEDIA (IMAGE, STICKER, VIDEO) ---
    const trueMessage = msg.message?.viewOnceMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message;

    // Cek keberadaan tipe media
    const isImage = trueMessage?.imageMessage || trueMessage?.stickerMessage;
    const isVideo = trueMessage?.videoMessage;

    if ((isImage || isVideo) && model) {
        try {
            // 1. Tentukan MimeType yang benar untuk AI
            let mimeType = "image/jpeg"; // Default untuk gambar/stiker
            if (isVideo) mimeType = "video/mp4";

            // 2. Download Media
            const buffer = await downloadMediaMessage(
                { key: msg.key, message: trueMessage },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );

            const prompt = `
            Kamu adalah Moderator Grup Kelas di Indonesia. Analisis media ini (gambar/video).

            Prioritas Deteksi (Urutan Penting):
            1. PORNOGRAFI/NSFW: Telanjang, alat kelamin, aktivitas seksual.
            2. KONTEN LGBTQ+ / HOMOEROTIS: Pria berciuman, bermesraan, gestur seksual sesama jenis (baik kartun/nyata).
            3. GESTUR MENGHINA: Jari tengah, dll.
            4. KEKERASAN EKSTREM: Gore, darah, mutilasi.
            5. TEKS KASAR: Tulisan makian di dalam video/gambar.

            Jawab HANYA dengan JSON:
            { "isSafe": boolean, "reason": "alasan singkat" }
            `;

            const result = await model.generateContent([
                prompt,
                { inlineData: { mimeType: mimeType, data: buffer.toString("base64") } }
            ]);

            const jsonText = result.response.text().replace(/```json|```/g, "").trim();
            return JSON.parse(jsonText);

        } catch (e) {
            console.error("Moderation AI Error:", e.message);

            // FALLBACK: Jika error karena safety block, anggap TIDAK AMAN
            if (e.message.includes("blocked") || e.message.includes("safety")) {
                return { isSafe: false, reason: "Konten diblokir oleh sistem keamanan AI (Sangat Berbahaya)" };
            }

            return { isSafe: true };
        }
    }

    return { isSafe: true };
}

module.exports = { checkContent };