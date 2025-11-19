// src/index.js
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path"); // Wajib ada untuk path absolut

// Import Modul Lokal
const { OWNER, MAPEL_OPTIONS } = require("./utils/constants");
const db = require("./utils/db"); // Prisma Database Wrapper
const { handleSession } = require("./utils/sessionHandler");
const cronLoader = require("./cron"); // Loader Cron Job (Task & General)

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  // ===================================
  // 1. INISIALISASI GEMINI AI
  // ===================================
  let model;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      console.log("✅ Koneksi ke Gemini AI berhasil.");
    } catch (e) {
      console.error("❌ Gagal inisialisasi Gemini AI:", e.message);
      model = null;
    }
  } else {
    console.warn("⚠️ PERINGATAN: GEMINI_API_KEY tidak ditemukan.");
    model = null;
  }

  // ===================================
  // 2. INISIALISASI SOCKET WA
  // ===================================
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // Kita pakai qrcode-terminal manual
  });

  // Dependency Injection Object (Bot Global)
  const bot = {
    sock,
    model,
    db, // Prisma Client & Helper
    sessions: new Map(),
    commands: new Map(),
    polls: new Map(),
    owner: OWNER,
    mapelOptions: MAPEL_OPTIONS,
  };

  // ===================================
  // 3. COMMAND LOADER (REKURSIF)
  // ===================================
  const commandsPath = path.join(__dirname, "commands");

  const getAllCommandFiles = (dirPath, arrayOfFiles = []) => {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllCommandFiles(fullPath, arrayOfFiles);
      } else if (file.endsWith(".js")) {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  };

  try {
    const commandFiles = getAllCommandFiles(commandsPath);
    
    for (const filePath of commandFiles) {
      try {
        const command = require(filePath);
        if (command.name) {
          bot.commands.set(command.name, command);
          // Log nama file relatif agar rapi
          const relativeName = path.relative(commandsPath, filePath);
          console.log(`[LOADER] Memuat: ${relativeName} -> ${command.name}`);
        }
      } catch (e) {
        console.error(`❌ Gagal memuat ${filePath}:`, e);
      }
    }
    console.log(`[LOADER] Total ${bot.commands.size} perintah berhasil dimuat.`);
  } catch (e) {
    console.error("[LOADER] Folder 'commands' tidak ditemukan atau error:", e.message);
  }

  // ===================================
  // 4. START CRON JOBS
  // ===================================
  // Menjalankan semua cron (Task H-1 & General Reminder) dari folder src/cron/
  cronLoader.initCronJobs(bot);

  // ===================================
  // 5. EVENT HANDLERS
  // ===================================
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log("Scan QR code ini dengan WhatsApp kamu!");
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("⚠️ Koneksi terputus, mencoba menyambungkan ulang...");
        startSock();
      } else {
        console.log("❌ Disconnected. Hapus folder auth_info_baileys untuk login ulang.");
      }
    } else if (connection === "open") {
      console.log("✅ Bot connected!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;

      let text = "";
      if (msg.message.conversation) text = msg.message.conversation;
      else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;

      const lower = text.toLowerCase();
      const args = text.split(" ").slice(1);
      const commandName = text.split(" ")[0].toLowerCase();
      
      const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

      console.log(`[MSG] ${from} | ${sender.split('@')[0]}: ${text}`);

      try {
        // A. Handle Polling
        const pollData = bot.polls.get(quotedMsgId);
        if (pollData && pollData.groupId === from) {
          const voteText = text.trim();
          const voteIndex = parseInt(voteText) - 1;

          if (voteIndex >= 0 && voteIndex < pollData.options.length) {
            pollData.votes.forEach((userSet) => userSet.delete(sender));
            pollData.votes.get(voteIndex).add(sender);
            await sock.sendMessage(from, { react: { text: "👍", key: msg.key } });
            continue;
          }
        }
        
        // B. Handle Session (Input bertahap seperti Add Task)
        if (bot.sessions.has(sender)) {
          await handleSession(bot, msg, text);
          continue;
        }

        // C. Handle Command
        const command = bot.commands.get(commandName);
        if (command) {
          await command.execute(bot, from, sender, args, msg, text);
          continue;
        }

        // D. Auto-reply Simple
        if (lower.includes("bot") && lower.includes("hidup")) {
          await sock.sendMessage(from, { text: "Hadir! 🤖" });
        }
        
      } catch (err) {
        console.error(`[ERROR] Handler:`, err);
      }
    }
  });
}

startSock();