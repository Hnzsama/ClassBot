const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const SmartGeminiModel = require("./src/utils/smartGemini");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
// Fix for node-fetch in CJS environment
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

// CONFIG
const TEST_TARGET_ID = "120363424780286140@g.us";
const AUTH_FOLDER = "auth_info_baileys";

async function startTest() {
    console.log("🛠️ Starting Manual Cron Test...");

    // 1. SETUP WA SOCKET
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Should use existing auth, but just in case
        browser: ["ClassBot Test", "Chrome", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    // Wait for connection
    await new Promise((resolve) => {
        sock.ev.on("connection.update", (update) => {
            const { connection } = update;
            if (connection === "open") {
                console.log("✅ Custom Test Socket Connected!");
                resolve();
            }
        });
    });

    // 2. SETUP MODEL
    let model = null;
    const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP].filter(Boolean);
    if (apiKeys.length > 0) {
        model = new SmartGeminiModel(apiKeys, {
            model: "gemini-2.5-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        });
    }

    const bot = { sock, model };

    console.log(`\n🎯 Target Group: ${TEST_TARGET_ID}\n`);

    // 3. TEST JAM 4
    await testJam4(bot);

    // 4. TEST MOTIVATION
    await testMotivation(bot);

    // 5. TEST WEATHER
    await testWeather(bot);

    console.log("\n✅ All Tests Completed. Exiting in 5s...");
    setTimeout(() => process.exit(0), 5000);
}

// ============================================
// LOGIC REPLICAS
// ============================================

async function testJam4(bot) {
    console.log("--- TESTING JAM 4 SENDER (CUSTOM LOGIC) ---");
    const JAM4_DIR = path.join(__dirname, "src/assets/jam4");
    const TEMP_PREFIX = "temp_test_jam4_";
    const SPECIAL_GROUP_ID = "120363421309923905@g.us";
    const SPECIAL_IMAGE = "bowok.png";

    if (!fs.existsSync(JAM4_DIR)) {
        console.error("❌ Folder not found:", JAM4_DIR);
        return;
    }

    const allFiles = fs.readdirSync(JAM4_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    if (allFiles.length === 0) { console.error("❌ Folder empty"); return; }

    // Targets to test
    const targets = [
        { id: SPECIAL_GROUP_ID, name: "Special Group" },
        { id: "123456dummy@g.us", name: "Random Group" } // Dummy
    ];

    // Generate Text Once
    let message = "Test Message";
    const aiPrompt = "Buatkan SATU ucapan jam 4 sore yang santai, lucu, singkat (maks 1 kalimat), sangat casual/gaul khas mahasiswa Indonesia. Tema: capek kuliah, butuh kopi, atau OTW pulang. HANYA OUTPUT TEKS UCAPAN SAJA. Jangan ada pembuka/penutup formal. Contoh style: 'Jam segini enaknya ngopi nih, skripsi pikir ntar aja.'";

    if (bot.model) {
        try {
            const res = await bot.model.generateContent(aiPrompt);
            const aiText = res.response.text().trim();
            const cleanText = aiText.replace(/^["']|["']$/g, '').replace(/\*\*/g, '*');
            const header = "☕ *Coffee Time!*";
            message = cleanText ? `${header}\n\n${cleanText}` : "Failed Gen";
        } catch (e) { console.error(e); }
    }

    // Loop Test
    for (const target of targets) {
        console.log(`\nTesting for ${target.name} (${target.id})...`);

        let chosenFile;
        // Logic Replication for Verification
        if (target.id === SPECIAL_GROUP_ID) {
            chosenFile = SPECIAL_IMAGE;
            if (!allFiles.includes(chosenFile)) chosenFile = null;
        } else {
            const availableFiles = allFiles.filter(f => f !== SPECIAL_IMAGE);
            if (availableFiles.length > 0) chosenFile = availableFiles[Math.floor(Math.random() * availableFiles.length)];
            else chosenFile = allFiles[0];
        }

        if (!chosenFile) { console.error("❌ Logic failed to pick file"); continue; }

        console.log(`> Algorithm selected: ${chosenFile}`);

        // Convert (Mocking the process for test script simplicity, ensuring ffmpeg runs)
        const inputPath = path.join(JAM4_DIR, chosenFile);
        const tempWebP = path.join(__dirname, `src/assets/${TEMP_PREFIX}${target.id.split('@')[0]}.webp`);

        const ffmpegArgs = [
            "-i", inputPath,
            "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=0x00000000",
            "-vcodec", "libwebp",
            "-lossless", "1",
            "-preset", "default",
            "-loop", "0",
            "-an",
            "-vsync", "0",
            "-y",
            tempWebP
        ];

        spawnSync(ffmpegPath, ffmpegArgs);

        if (fs.existsSync(tempWebP)) {
            const stickerFn = fs.readFileSync(tempWebP);
            // Only actually send if it's the real test target from config, otherwise just log success
            // But wait, the user asked to test "send to here" which is usually the special group or their own.
            // The TEST_TARGET_ID constant in this script is user's group.
            // Let's force send to TEST_TARGET_ID but LOG what image WOULD have been sent if it was that target.

            // To actually verify visually, we should send to TEST_TARGET_ID using the logic of "Special Group".
            if (target.id === SPECIAL_GROUP_ID) {
                await bot.sock.sendMessage(TEST_TARGET_ID, { text: `[TEST: Simulating Special Group] ${message}` });
                await bot.sock.sendMessage(TEST_TARGET_ID, { sticker: stickerFn });
                console.log("✅ Sent Special Logic Result");
            } else {
                await bot.sock.sendMessage(TEST_TARGET_ID, { text: `[TEST: Simulating Random Group] ${message}` });
                await bot.sock.sendMessage(TEST_TARGET_ID, { sticker: stickerFn });
                console.log("✅ Sent Random Logic Result");
            }
            fs.unlinkSync(tempWebP);
        } else {
            console.error("❌ Failed convert");
        }
    }
}

async function testMotivation(bot) {
    console.log("--- TESTING MOTIVATION SENDER ---");
    const MOTIVATION_DIR = path.join(__dirname, "src/assets/motivations");
    const TEMP_WEBP_PATH = path.join(__dirname, "src/assets/temp_test_motivation.webp");

    if (!fs.existsSync(MOTIVATION_DIR)) {
        console.error("❌ Motivation Dir not found");
        return;
    }

    const files = fs.readdirSync(MOTIVATION_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    if (files.length === 0) {
        console.error("❌ No motivation images found");
        return;
    }

    const randomFile = files[Math.floor(Math.random() * files.length)];
    const inputPath = path.join(MOTIVATION_DIR, randomFile);

    const ffmpegArgs = [
        "-i", inputPath,
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:-1:-1:color=0x00000000",
        "-vcodec", "libwebp",
        "-lossless", "1",
        "-preset", "default",
        "-loop", "0",
        "-an",
        "-vsync", "0",
        "-y",
        TEMP_WEBP_PATH
    ];

    spawnSync(ffmpegPath, ffmpegArgs);

    if (fs.existsSync(TEMP_WEBP_PATH)) {
        const stickerFn = fs.readFileSync(TEMP_WEBP_PATH);

        let message = "🌙 *Test Motivation*";
        if (bot.model) {
            try {
                const aiPrompt = "Buatkan SATU quotes motivasi malam singkat (maks 2 kalimat) yang ngena/deep buat mahasiswa yang baru mau tidur. Tema: Semangat belajar, masa depan, rest is productive. HANYA OUTPUT TEKS QOUTES SAJA. Jangan ada pembuka 'Ini pilihannya' dll. Format: 'Kata-kata mutiara. (Emoji)' akhiri dengan baris baru dan hashtag #MidnightMotivation. Jangan pakai tanda petik.";
                const res = await bot.model.generateContent(aiPrompt);
                const aiText = res.response.text().trim();
                message = `🌙 *Midnight Motivation* 🌙\n\n${aiText.replace(/^["']|["']$/g, '')}`;
            } catch (e) { console.error(e); }
        }

        await bot.sock.sendMessage(TEST_TARGET_ID, { text: message });
        await bot.sock.sendMessage(TEST_TARGET_ID, { sticker: stickerFn });
        console.log("✅ Motivation Sent.");

        fs.unlinkSync(TEMP_WEBP_PATH);
    } else {
        console.error("❌ Failed to create sticker motivation");
    }
}

async function testWeather(bot) {
    console.log("--- TESTING WEATHER SENDER ---");
    // Mock Data to match what actual cron does
    const summary = [
        { jam: "Pagi", suhu: 26, cuaca: "Berawan" },
        { jam: "Siang", suhu: 30, cuaca: "Cerah" },
        { jam: "Malam", suhu: 25, cuaca: "Hujan Ringan" }
    ];
    const location = `📍 Ketintang, Surabaya`;
    const header = `🌤️ *Prakiraan Cuaca Surabaya Hari Ini* 🌤️`;

    try {
        let message = "Test Weather Fallback";

        if (bot.model) {
            const aiPrompt = `
Data Cuaca: ${JSON.stringify(summary)}
Lokasi: ${location}

Tugas: Buat laporan cuaca super singkat.
JANGAN pakai format markdown heading (seperti # atau ##).
JANGAN tambah kalimat pembuka seperti "Berikut laporan cuaca" atau "Halo mahasiswa".
LANGSUNG SAJA isi format di bawah ini:

${header}

${location}

• *Pagi:* {isi suhu}°C, {isi cuaca}
• *Siang:* {isi suhu}°C, {isi cuaca}
• *Malam:* {isi suhu}°C, {isi cuaca}

_Sumber: BMKG_
`;
            try {
                const res = await bot.model.generateContent(aiPrompt);
                message = res.response.text();
            } catch (e) { console.error(e); }
        }

        await bot.sock.sendMessage(TEST_TARGET_ID, { text: message });
        console.log("✅ Weather Sent.");

    } catch (e) {
        console.error("❌ Weather Test Failed:", e);
    }
}

startTest();
