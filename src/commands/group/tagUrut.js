module.exports = {
    name: "#group-tagseq",
    alias: ["#urut"],
    description: "Tag members sequentially. Format: #group-tagseq @user1 @user2",
    execute: async (bot, from, sender, args, msg) => {
        if (!from.endsWith("@g.us")) return;

        try {
            // 1. Ambil Metadata Grup
            const groupMetadata = await bot.sock.groupMetadata(from);
            let participants = groupMetadata.participants;

            // 2. Cek Exception (User yang ditag di pesan ini)
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
            const mentionedJids = contextInfo.mentionedJid || [];

            // Tambahkan pengirim command ke exception (opsional, tapi biasanya yang ngetag gak mau ditag)
            // mentionedJids.push(sender); 

            // 3. Filter Peserta
            // Hapus yang ada di mentionedJids, dan Bot sendiri
            const filteredParticipants = participants.filter(p => {
                return !mentionedJids.includes(p.id) && p.id !== bot.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            });

            // 4. Buat List Tag
            let text = `📋 *TAG URUT MEMBER*\n`;
            text += `Total: ${filteredParticipants.length} Member\n`;
            text += `Pengecualian: ${mentionedJids.length} Orang\n\n`;

            const mentions = [];

            filteredParticipants.forEach((p, index) => {
                text += `${index + 1}. @${p.id.split('@')[0]}\n`;
                mentions.push(p.id);
            });

            // 5. Kirim
            await bot.sock.sendMessage(from, {
                text: text,
                mentions: mentions
            });

        } catch (e) {
            console.error(e);
            await bot.sock.sendMessage(from, { text: "❌ Gagal mengambil data grup." });
        }
    }
};
