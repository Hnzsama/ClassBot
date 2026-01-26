const { generateAIContent } = require('../../utils/aiHandler');

module.exports = {
    name: "#class-ai",
    description: "Manage Class (Create/Edit) via AI. Example: '#class-ai Create class IT-A description Batch 2024'",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, db, model } = bot;
        if (!from.endsWith("@g.us")) return sock.sendMessage(from, { text: "❌ Hanya untuk grup." });

        const rawInput = text.replace("#class-ai", "").trim();
        if (!rawInput) return sock.sendMessage(from, { text: "⚠️ Masukkan instruksi. Contoh: 'Buat kelas TI-A'" });

        // 1. Context
        const existingClass = await db.prisma.class.findFirst({
            where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
        });

        const context = existingClass
            ? `CURRENT CLASS: ID=${existingClass.id}, Name=${existingClass.name}, Desc=${existingClass.description}`
            : "CURRENT CLASS: NONE (Belum ada kelas di grup ini).";

        const systemPrompt = `
    Peran: Class Administrator AI.
    Tugas: Menerjemahkan bahasa natural user menjadi aksi database untuk manajemen KELAS.
    
    Actions:
    1. "create": Jika user ingin buat kelas baru.
    2. "update": Jika user ingin ubah nama/deskripsi kelas.
    
    Output JSON Schema:
    [
      { "action": "create", "name": "TI-A", "description": "Angkatan 2024" },
      { "action": "update", "name": "TI-B", "description": "Baru" } 
    ]
    
    Aturan:
    - Jika "create" tapi kelas sudah ada dalam CONTEXT, ganti jadi "update" atau return error/ignore.
    - Jika "update" tapi kelas belum ada, ganti jadi "create" (bantu user).
    `;

        // 2. AI Process
        try {
            await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

            const actions = await generateAIContent(model, systemPrompt, context, rawInput);

            if (!actions || actions.length === 0) {
                return sock.sendMessage(from, { text: "❌ AI tidak memahami instruksi." });
            }

            let reply = "";

            for (const act of actions) {
                if (act.action === "create") {
                    if (existingClass) {
                        reply += `⚠️ Kelas sudah ada (*${existingClass.name}*). Gunakan instruksi 'ubah nama' jika ingin edit.\n`;
                        continue;
                    }
                    const newClass = await db.prisma.class.create({
                        data: {
                            mainGroupId: from,
                            name: act.name,
                            description: act.description || "",
                            semesters: { create: { name: "Semester 1", isActive: true } }
                        }
                    });
                    reply += `✅ Kelas *${newClass.name}* berhasil dibuat!\n`;
                }
                else if (act.action === "update") {
                    if (!existingClass) {
                        reply += `⚠️ Belum ada kelas. Saya buatkan baru ya...\n`;
                        const newClass = await db.prisma.class.create({
                            data: {
                                mainGroupId: from,
                                name: act.name,
                                description: act.description || "",
                                semesters: { create: { name: "Semester 1", isActive: true } }
                            }
                        });
                        reply += `✅ Kelas *${newClass.name}* berhasil dibuat!\n`;
                        continue;
                    }

                    const updateData = {};
                    if (act.name) updateData.name = act.name;
                    if (act.description) updateData.description = act.description;

                    await db.prisma.class.update({
                        where: { id: existingClass.id },
                        data: updateData
                    });
                    reply += `✅ Data kelas diupdate.\n`;
                }
            }

            if (reply) await sock.sendMessage(from, { text: reply });

        } catch (e) {
            console.error(e);
            await sock.sendMessage(from, { text: "❌ Terjadi kesalahan sistem." });
        }
    }
};
