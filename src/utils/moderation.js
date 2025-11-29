// src/utils/moderation.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const BAD_WORDS_LIST = [
    // ... (list kata kotor Anda yang panjang tadi) ...
    "jancok", "jancuk", "janck", "jnck", "juancok", "janc",
    "bangsat", "bgst", "bangs4t",
    "bajingan", "bjingan", "hancok",
    "keparat", "brengsek", "biadab", "sialan", "setan", "iblis",
    "tai", "taik", "t4i", "telek",
    "anjing", "njing", "ajg", "anying", "asu", "asw",
    "babi", "b4bi",
    "monyet", "kunyuk", "beruk", "kampret", "cebong", "kadrun",
    "kontol", "kntl", "konak",
    "memek", "mmk", "pepek", "meki",
    "jembut", "itil", "bijire",
    "ngentot", "entot", "ngewe", "ewe", "sange", "horny",
    "puki", "pukimak", "pantek", "kimak",
    "bokep", "porno", "nude", "bugil", "semok", "montok",
    "colil", "ngocok", "masturbasi",
    "goblok", "g0blok", "gblkk",
    "tolol", "tol0l",
    "idiot", "autis", 
    "bego", "dongo", "dungu", "bloon", "bego",
    "cacat", "sumbing", "gila", "sinting", "sarap",
    "matamu", "ndasmu", "cocot", "bacot", "bct",
    "lonte", "perek", "jalang", "bispak", "jablay",
    "bencong", "banci", "homo", "lesbi", "lgbt",
    "maling", "rampok", "copet",
    "fuck", "f*ck", "shit", "sh*t", "bitch", "b*tch", "bastard", "slut",
    "whore", "cunt", "dick", "pussy", "cock", "asshole", "nigger", "nigga",
    "retard", "moron", "loser", "damn", "fag", "twat", "prick", "screw",
    "bollocks", "bugger", "arse", "wanker", "jerk", "douche", "tits", "boobs",
    "cum", "masturbate", "penis", "vagina", "sex", "porn", "xxx", "erotic",
    "fukk", "sh1t", "b1tch", "b1tchez", "d1ck", "p1ss", "n1gger", "n1gga",
    "m0ron", "f4g", "tw4t", "pr1ck", "douchebag", "c0ck", "c0cksucker"
];
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
            return { isSafe: true }; // Fail open jika AI error/timeout
        }
    }

    return { isSafe: true };
}

module.exports = { checkContent };