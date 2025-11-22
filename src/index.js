const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const db = require("./utils/db.js");
const { handleSession } = require("./utils/sessionHandler");
const cronLoader = require("./cron");
const { handleVipMedia } = require("./utils/vipMediaHandler");

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
  const { version } = await fetchLatestBaileysVersion();

  let model;
  if (config.gemini.apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
      model = genAI.getGenerativeModel({ 
        model: config.gemini.modelName,
        systemInstruction: config.gemini.systemInstruction
      });
    } catch (e) {
      model = null;
    }
  }

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: [config.botName, "Chrome", "1.0.0"],
  });

  const bot = {
    sock,
    model,
    db, 
    config,
    sessions: new Map(),
    commands: new Map(),
    polls: new Map(),
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
    let loadedCount = 0;

    console.log("\n📂 Loading Commands..."); // Header Log

    for (const filePath of commandFiles) {
      try {
        const command = require(filePath);
        if (command.name) {
          bot.commands.set(command.name, command);
          
          // Hitung relative path agar log bersih (misal: tugas/add.js)
          const relativeName = path.relative(commandsPath, filePath);
          console.log(`   ✅ Loaded: ${relativeName} -> ${command.name}`);
          
          loadedCount++;
        }
      } catch (err) {
        console.error(`   ❌ Gagal load ${filePath}:`, err.message);
      }
    }
    console.log(`✨ Total ${loadedCount} commands siap digunakan.\n`);

  } catch (e) {
    console.error("❌ Error reading commands folder:", e);
  }

  cronLoader.initCronJobs(bot);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        startSock();
      }
    } else if (connection === "open") {
      console.log(`Connected: ${config.botName}`);
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
      else if (msg.message.imageMessage) text = msg.message.imageMessage.caption || "";
      else if (msg.message.videoMessage) text = msg.message.videoMessage.caption || "";

      const args = text.split(" ").slice(1);
      const commandName = text.split(" ")[0].toLowerCase();
      const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

      try {
        if (config.vipTriggerId) {
             await handleVipMedia(bot, msg, from, sender); 
        }

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
        
        if (bot.sessions.has(sender)) {
          await handleSession(bot, msg, text);
          continue;
        }

        const command = bot.commands.get(commandName);
        if (command) {
          await command.execute(bot, from, sender, args, msg, text);
          continue;
        }

      } catch (err) {
        console.error(err);
      }
    }
  });
}

startSock();