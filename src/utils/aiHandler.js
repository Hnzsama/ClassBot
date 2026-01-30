const { downloadMediaMessage } = require('@whiskeysockets/baileys');

class AIHandler {
    constructor(bot) {
        this.model = bot.model;
        this.sock = bot.sock;
    }

    /**
     * Extracts media from a message (quoted or direct).
     * @param {object} msg - The Baileys message object
     * @param {string} from - The sender JID
     * @returns {Promise<{buffer: Buffer, mimeType: string, type: string, data: string}|null>}
     */
    async downloadMedia(msg, from) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Define priority: Image > Document > Video
        let targetMsg = null;
        let mimeType = 'text/plain';
        let type = 'text';

        if (quotedMsg) {
            if (quotedMsg.imageMessage) {
                targetMsg = quotedMsg.imageMessage;
                mimeType = 'image/jpeg';
                type = 'image';
            } else if (quotedMsg.documentMessage) {
                targetMsg = quotedMsg.documentMessage;
                mimeType = targetMsg.mimetype || 'application/pdf';
                type = 'document';
            } else if (quotedMsg.videoMessage) {
                targetMsg = quotedMsg.videoMessage;
                mimeType = targetMsg.mimetype || 'video/mp4';
                type = 'video';
            }
        }

        if (!targetMsg) return null;

        try {
            // downloadMediaMessage expects the wrapping message object
            const messageKey = {
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                remoteJid: from
            };

            // Construct a fake message object that mimics the structure downloadMediaMessage expects
            const fakeMsg = { key: messageKey, message: quotedMsg };

            const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, { reuploadRequest: this.sock.updateMediaMessage });
            return { buffer, mimeType, type, data: buffer.toString('base64'), mediaMessage: targetMsg };
        } catch (e) {
            console.error("AIHandler Download Error:", e);
            return null;
        }
    }

    /**
     * Generates and parses JSON response from Gemini.
     * @param {string} systemPrompt - Core instructions
     * @param {string} userText - User's additional input
     * @param {object} media - { mimeType, data } (from downloadMedia)
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async generateJSON(systemPrompt, userText = "", media = null) {
        if (!this.model) return { success: false, error: "Model AI tidak aktif." };

        try {
            const parts = [{ text: systemPrompt }];

            if (userText) {
                parts.push({ text: `Input User: "${userText}"` });
            }

            if (media && media.data) {
                parts.push({
                    inlineData: {
                        mimeType: media.mimeType,
                        data: media.data
                    }
                });
            }

            // Standardize call to generateContent
            const result = await this.model.generateContent({ contents: [{ role: 'user', parts }] });
            const responseText = result.response.text();

            // Robust JSON extraction (Array or Object)
            const jsonMatch = responseText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);

            if (!jsonMatch) {
                return { success: false, raw: responseText, error: "Format JSON tidak ditemukan dalam respon AI." };
            }

            try {
                const data = JSON.parse(jsonMatch[0]);
                return { success: true, data };
            } catch (parseErr) {
                return { success: false, raw: responseText, error: "Gagal memparsing JSON dari respon AI." };
            }

        } catch (e) {
            console.error("AIHandler Generate Error:", e);
            return { success: false, error: e.message };
        }
    }
}

module.exports = AIHandler;
