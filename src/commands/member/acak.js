module.exports = {
    name: "#acak",
    description: "Mengacak anggota kelas dengan sistem poin frekuensi. Format: #acak [Jml Kandidat] [Jml Putaran] [Exception NIM 3 digit...]",
    execute: async (bot, from, sender, args, msg, text) => {
        const { sock, db } = bot;

        // Basic usage check
        if (args.length < 2) {
            return sock.sendMessage(from, {
                text: "⚠️ Format salah.\n\nGunakan: `#acak [Jumlah Pemenang] [Jumlah Putaran] [Exception NIM (opsional)]`\n\nContoh:\n`#acak 3 50` (Pilih 3 orang, simulasi 50x)\n`#acak 1 20 001,002` (Pilih 1 orang, simulasi 20x, kecuali NIM akhiran 001 & 002)"
            });
        }

        const jumlahKandidat = parseInt(args[0]);
        const jumlahPutaran = parseInt(args[1]);
        // Support both space and comma separation
        const exceptions = args.slice(2).join(",").split(",").map(e => e.trim()).filter(e => e.length > 0);

        if (isNaN(jumlahKandidat) || jumlahKandidat < 1) return sock.sendMessage(from, { text: "⚠️ Jumlah kandidat harus angka > 0." });
        if (isNaN(jumlahPutaran) || jumlahPutaran < 1) return sock.sendMessage(from, { text: "⚠️ Jumlah putaran harus angka > 0." });

        try {
            // 1. Get Class
            const kelas = await db.prisma.class.findFirst({
                where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] }
            });
            if (!kelas) return sock.sendMessage(from, { text: "❌ Kelas tidak ditemukan." });

            // 2. Get Members
            const members = await db.prisma.member.findMany({
                where: { classId: kelas.id }
            });

            if (members.length === 0) return sock.sendMessage(from, { text: "❌ Tidak ada anggota di kelas ini." });

            // 3. Filter Members
            const eligibleMembers = members.filter(m => {
                const nimSuffix = m.nim.slice(-3);
                return !exceptions.includes(nimSuffix);
            });

            if (eligibleMembers.length === 0) return sock.sendMessage(from, { text: "❌ Tidak ada anggota yang tersisa setelah difilter exception." });
            if (eligibleMembers.length < jumlahKandidat) return sock.sendMessage(from, { text: `⚠️ Hanya ada ${eligibleMembers.length} anggota yang tersedia, tidak cukup untuk memilih ${jumlahKandidat} kandidat.` });

            // 4. Simulation Logic
            const scores = {};
            eligibleMembers.forEach(m => scores[m.id] = 0);

            for (let i = 0; i < jumlahPutaran; i++) {
                const randomIdx = Math.floor(Math.random() * eligibleMembers.length);
                const winner = eligibleMembers[randomIdx];
                scores[winner.id]++;
            }

            // 5. Sort Candidates
            // Convert to array for sorting: [{ member, score }]
            let rankedCandidates = eligibleMembers.map(m => ({
                member: m,
                score: scores[m.id]
            })).sort((a, b) => b.score - a.score);

            // 6. Selection Logic (Handling Ties)
            const finalWinners = [];

            // Phase 1: Take clear winners
            let i = 0;
            while (finalWinners.length < jumlahKandidat && i < rankedCandidates.length) {
                const currentCandidate = rankedCandidates[i];

                // Check for ties at this rank
                const tieGroup = rankedCandidates.filter(c => c.score === currentCandidate.score);

                // If adding the whole group doesn't exceed the limit, add them all
                if (finalWinners.length + tieGroup.length <= jumlahKandidat) {
                    finalWinners.push(...tieGroup.map(c => c.member));
                    i += tieGroup.length;
                } else {
                    // Tie-breaker needed!
                    const needed = jumlahKandidat - finalWinners.length;

                    // Shuffle the tie group purely randomly to pick the needed amount
                    const shuffledTies = tieGroup.sort(() => 0.5 - Math.random());
                    const selectedTies = shuffledTies.slice(0, needed);

                    finalWinners.push(...selectedTies.map(c => c.member));
                    break;
                }
            }

            // 7. Output Result message
            let msgText = `🎲 *HASIL ACAK ANGGOTA* 🎲\n`;
            msgText += `🏆 *Kandidat:* ${jumlahKandidat}\n`;
            msgText += `🔄 *Putaran:* ${jumlahPutaran}\n`;
            if (exceptions.length > 0) msgText += `🚫 *Exception:* ${exceptions.join(", ")}\n`;
            msgText += `---------------------------\n`;

            finalWinners.forEach((m, idx) => {
                msgText += `${idx + 1}. ${m.nama} (${m.nim})\n`;
                // const score = scores[m.id];
                // msgText += `   (Muncul: ${score}x)\n`;
            });

            return sock.sendMessage(from, { text: msgText });

        } catch (e) {
            console.error(e);
            return sock.sendMessage(from, { text: "❌ Terjadi error saat mengacak." });
        }
    }
};
