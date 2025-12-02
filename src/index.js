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
const path = require("path");

const { OWNER } = require("./utils/constants");
const db = require("./utils/db");
const { handleSession } = require("./utils/sessionHandler");
const cronLoader = require("./cron");
const { checkContent } = require("./utils/moderation");


async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  // INISIALISASI GEMINI AI
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

  // INISIALISASI SOCKET WA
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
  });

  // Dependency Injection Object (Bot Global)
  const bot = {
    sock,
    model,
    db, 
    sessions: new Map(),
    commands: new Map(),
    polls: new Map(),
    owner: OWNER,
    processedMsgs: new Set(),
  };

  // COMMAND LOADER
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
        }
      } catch (e) {
        console.error(`❌ Gagal memuat ${filePath}:`, e);
      }
    }
    console.log(`[LOADER] Total ${bot.commands.size} perintah berhasil dimuat.`);
  } catch (e) {
    console.error("[LOADER] Folder 'commands' tidak ditemukan:", e.message);
  }

  // START CRON JOBS
  cronLoader.initCronJobs(bot);

  // EVENT HANDLERS
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

      // Anti Double Process
      if (bot.processedMsgs.has(msg.key.id)) continue;
      bot.processedMsgs.add(msg.key.id);
      setTimeout(() => bot.processedMsgs.delete(msg.key.id), 5000);

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;

      let text = "";
      if (msg.message.conversation) text = msg.message.conversation;
      else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text;
      else if (msg.message.imageMessage) text = msg.message.imageMessage.caption || "";
      else if (msg.message.videoMessage) text = msg.message.videoMessage.caption || "";

      const lower = text.toLowerCase();
      const args = text.split(" ").slice(1);
      const commandName = text.split(" ")[0].toLowerCase();
      const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

      console.log(`[MSG] ${from} | ${sender.split('@')[0]}: ${text.substring(0, 30)}...`);

      try {

        const kelasConfig = await bot.db.prisma.class.findFirst({
            where: { OR: [{ mainGroupId: from }, { inputGroupId: from }] },
            select: { enableFilter: true } 
        });

        if (kelasConfig && kelasConfig.enableFilter) {
            const moderation = await checkContent(bot, msg, text, sender);
            
            if (!moderation.isSafe) {
                console.log(`[MODERATION] Deteksi konten toxic dari ${sender}: ${moderation.reason}`);
                
                try {
                    // COBA HAPUS PESAN
                    await sock.sendMessage(from, { delete: msg.key });
                    
                    // JIKA BERHASIL (Tidak masuk catch), KIRIM PERINGATAN
                    await sock.sendMessage(from, { 
                        text: `⚠️ @${sender.split("@")[0]} Pesan dihapus!\n⛔ *Alasan:* ${moderation.reason}\n\n_Tolong jaga etika di grup kelas._`,
                        mentions: [sender]
                    });

                } catch (e) {
                    // JIKA GAGAL HAPUS (Bot bukan admin)
                    console.error(`[MODERATION] Gagal hapus pesan: ${e.message}`);
                    await sock.sendMessage(from, { 
                        text: `⚠️ *PERINGATAN MODERASI* ⚠️\n\nBot mendeteksi pesan tidak pantas dari @${sender.split("@")[0]}.\n⛔ *Alasan:* ${moderation.reason}\n\n❌ *Gagal Menghapus:* Bot belum menjadi **ADMIN**. Harap admin grup menjadikan bot sebagai admin agar fitur filter berfungsi.`,
                        mentions: [sender]
                    });
                }
                
                continue;
            }
        }

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
        
        // Handle Session
        if (bot.sessions.has(sender)) {
          await handleSession(bot, msg, text);
          continue;
        }

        // Handle Command
        const command = bot.commands.get(commandName);
        if (command) {
          await command.execute(bot, from, sender, args, msg, text);
          continue;
        }

        // Auto-reply Simple
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