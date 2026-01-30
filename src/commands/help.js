const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

// Helper: Get all directories in src/commands
const getCommandCategories = () => {
  return fs.readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
};

// Helper: Scan commands in a specific folder
const getCommandsInFolder = (folderName) => {
  const cmdDir = path.join(COMMANDS_DIR, folderName);
  if (!fs.existsSync(cmdDir)) return [];

  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  const commands = [];

  for (const file of files) {
    try {
      const cmdPath = path.join(cmdDir, file);
      // Delete cache for hot-reload feel
      delete require.cache[require.resolve(cmdPath)];
      const cmd = require(cmdPath);
      if (cmd.name && cmd.description) {
        commands.push({ name: cmd.name, desc: cmd.description });
      }
    } catch (e) {
      console.error(`Skipping command ${file}:`, e.message);
    }
  }
  return commands;
};

// Helper: Get root commands (files directly in src/commands)
const getRootCommands = () => {
  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));
  const commands = [];
  for (const file of files) {
    if (file === 'help.js') continue; // Skip self
    try {
      const cmdPath = path.join(COMMANDS_DIR, file);
      delete require.cache[require.resolve(cmdPath)]; // Hot reload
      const cmd = require(cmdPath);
      if (cmd.name && cmd.description) {
        commands.push({ name: cmd.name, desc: cmd.description });
      }
    } catch (e) { }
  }
  return commands;
}

module.exports = {
  name: "#help",
  description: "Pusat bantuan bot OTOMATIS. Format: #help [kategori]",
  execute: async (bot, from, sender, args, msg) => {
    const { sock } = bot;
    const pushName = msg.pushName || sender.split("@")[0];
    const categoryInput = args[0] ? args[0].toLowerCase() : "";

    // Header Mapping for Prettier Titles
    const headerMap = {
      'class': '🏫 KELAS', 'semester': '📅 SEMESTER', 'subject': '📚 MAPEL',
      'task': '📝 TUGAS', 'reminder': '🔔 REMINDER', 'member': '👥 MEMBER',
      'justForFun': '🤖 FUN & AI', 'group': '🌐 GROUP', 'admin': '👮 ADMIN',
      'general': '📌 UMUM', 'root': '⚡ COMMANDS LAIN'
    };

    const categories = getCommandCategories();

    // 1. HELP DETAIL (Dynamic Category)
    if (categoryInput) {
      // Check if input matches a folder
      const matchedCategory = categories.find(c => c.toLowerCase() === categoryInput);

      if (matchedCategory) {
        const cmds = getCommandsInFolder(matchedCategory);
        if (cmds.length === 0) return sock.sendMessage(from, { text: `⚠️ Kategori *${matchedCategory}* kosong.` });

        const header = headerMap[matchedCategory] || matchedCategory.toUpperCase();
        let text = `╭── [ *${header}* ]\n│\n`;

        cmds.sort((a, b) => a.name.localeCompare(b.name));
        cmds.forEach(c => text += `├ \`${c.name}\`\n│ ${c.desc}\n│\n`);

        text = text.slice(0, -2); // Trim last box chars
        text += `\n╰ _Total: ${cmds.length} Command_\n\n_Ketik_ \`#help\` _kembali._`;
        return sock.sendMessage(from, { text: `📂 *MENU ${header}*\n\n${text}` });
      }

      // Special Case: "root" or "lain" for root files
      if (categoryInput === 'lain' || categoryInput === 'root') {
        const rootCmds = getRootCommands();
        let text = `╭── [ *COMMANDS LAIN* ]\n│\n`;
        rootCmds.forEach(c => text += `├ \`${c.name}\`\n│ ${c.desc}\n│\n`);
        text += `╰ _Total: ${rootCmds.length}_`;
        return sock.sendMessage(from, { text });
      }

      // Panduan Manual (Static)
      if (categoryInput === 'setup') {
        return sock.sendMessage(from, { text: `⚙️ *SETUP GUIDE*\n\n1. #class-add [Nama], [Deskripsi]\n2. #semester-ai Create 8 semester\n3. #subject-ai Add subjects...\n4. #member-add-ai` });
      }

      return sock.sendMessage(from, { text: `⚠️ Kategori tidak ditemukan.\nCek daftar dengan ketik \`#help\`` });
    }

    // 2. MAIN MENU (Dynamic List)
    let menuText = `🤖 *CLASS BOT ASSISTANT*\n`;
    menuText += `Halo, *${pushName}*! 👋\n\n`;
    menuText += `👇 *PILIH KATEGORI PERINTAH:*\n`;
    menuText += `Ketik \`#help [nama_kategori]\`\n\n`;

    // Loop categories
    menuText += `╭── [ 📌 *DAFTAR KATEGORI* ]\n│\n`;

    // Priority sorting for display?
    const priority = ['class', 'task', 'member', 'subject', 'semester', 'reminder'];
    const sortedCats = categories.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const cat of sortedCats) {
      const label = headerMap[cat] || cat.toUpperCase();
      // Optional: Count commands in it? (Might be slow if many files, skipping for speed)
      menuText += `├ \`#help ${cat}\` (${label})\n`;
    }

    // Root commands check
    const roots = getRootCommands();
    if (roots.length > 0) {
      menuText += `├ \`#help lain\` (Lainnya)\n`;
    }

    menuText += `│\n╰ \`#help setup\` (Panduan Awal)\n\n`;
    menuText += `_v2.0 Dynamic Menu_`;

    await sock.sendMessage(from, { text: menuText, mentions: [sender] });
  }
};
