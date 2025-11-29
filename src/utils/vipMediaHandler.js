// src/utils/vipMediaHandler.js

const VIP_TRIGGER_ID_NUMBER = "5255759872022"; // ID TARGET YANG BENAR
// 52557598720232

async function handleVipMedia(bot, msg, from, sender) {
    const { sock } = bot;

    // 1. Check if the sender is the VIP
    if (!sender.includes(VIP_TRIGGER_ID_NUMBER)) {
        return false;
    }

    // --- LOGIKA PERBAIKAN: HANDLE MULTI-LEVEL WRAPPER ---
    // Cek apakah ada kontainer View Once atau Ephemeral
    const viewOnceWrapper = msg.message.viewOnceMessage || msg.message.viewOnceMessageV2;
    const trueMessage = viewOnceWrapper?.message 
                       || msg.message.ephemeralMessage?.message
                       || msg.message;
    // ----------------------------------------------------

    // 2. Check for Media Presence (Including Wrapper Presence)
    const isMedia = trueMessage.imageMessage || 
                    trueMessage.videoMessage || 
                    trueMessage.documentMessage || 
                    trueMessage.audioMessage ||
                    trueMessage.stickerMessage ||
                    !!viewOnceWrapper; // <--- FIX KRUSIAL: Deteksi keberadaan container view once

    if (isMedia) {
        // Ambil kunci media dari objek yang benar (trueMessage)
        const mediaTypeKeys = Object.keys(trueMessage).filter(key => key.endsWith('Message'));
        // Fallback untuk file type, jika View Once
        const fileType = mediaTypeKeys.length > 0 ? mediaTypeKeys[0].replace('Message', '').toUpperCase() : 'VIEWONCE'; 

        const warningText = `
🚨 *KONTEN DI LUAR NALAR TERDETEKSI!* 🚨
━━━━━━━━━━━━━━━━━━━
Sender: @${sender.split("@")[0]}

⚠️ *PERINGATAN KHUSUS KELAS:*
Media ini dicurigai mengandung unsur jomok, menjijikkan, atau hal-hal yang **di luar nalar manusia**.

Mohon siapkan mental, siapkan mata, dan bukalah dengan risiko ditanggung sendiri!

Jenis File: (${fileType})
━━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(from, {
            text: warningText,
            mentions: [sender]
        });
        return true; // Alert was sent
    }

    return false;
}

module.exports = { handleVipMedia };