const fs = require('fs');
const path = require('path');

// Mapping Category ID (from args) -> Folder Name (in src/commands)
const CATEGORY_MAP = {
  'kelas': 'class',
  'semester': 'semester',
  'mapel': 'subject',
  'subject': 'subject',
  'tugas': 'task',
  'task': 'task',
  'reminder': 'reminder',
  'member': 'member',
  'util': 'group', // Assuming utils are in group or spread
  'fun': 'justForFun',
  'ai': 'justForFun', // Grouping AI fun stuff here
  'admin': 'admin'
};

// Helper: Scan commands in directory
const getCommandsInFolder = (folderName) => {
  const cmdDir = path.join(__dirname, folderName);
  if (!fs.existsSync(cmdDir)) return [];

  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  const commands = [];

  for (const file of files) {
    try {
      const cmdPath = path.join(cmdDir, file);
      // Delete cache to ensure fresh load (optional, be careful in prod)
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

module.exports = {
  name: "#help",
  description: "Pusat bantuan bot. Format: #help [kategori]",
  execute: async (bot, from, sender, args, msg) => {
    const { sock } = bot;
    const pushName = msg.pushName || sender.split("@")[0];
    const categoryInput = args[0] ? args[0].toLowerCase() : "";

    // --- 1. STATIC GUIDES (Panduan Manual) ---

    // SETUP
    if (categoryInput === "setup" || categoryInput === "panduan") {
      const text = `⚙️ *ADMIN SETUP GUIDE*

*1. CREATE CLASS (In Main Group)*
Type: \`#class-add [Name], [Description]\`
_(Use comma to separate)_

*2. CURRICULUM (Semester & Subjects)*
Type: \`#semester-ai Create semesters 1 to 8 then activate semester 1\`
Type: \`#subject-ai Add subjects Math, Algorithms, Database\`

*3. STUDENT DATA*
Type: \`#member-add-ai\`
_(Then send attendance photo/name list)_

_Type_ \`#help\` _to return._`;
      return await sock.sendMessage(from, { text });
    }

    // COMMUNITY
    if (categoryInput === "community") {
      const text = `🌐 *COMMUNITY GROUP GUIDE*

*COMMANDS:*
├ \`#class-add [Name], [Description]\`
│ (Run in Main Group/Info Channel).
│
╰ \`#class-assign [Class ID] [Main Group ID]\`
  (Run in Community/Chat Group).

_Type_ \`#help\` _to return._`;
      return await sock.sendMessage(from, { text });
    }

    // --- 2. DYNAMIC COMMAND LISTS ---

    const targetFolder = CATEGORY_MAP[categoryInput];

    if (targetFolder) {
      const cmds = getCommandsInFolder(targetFolder);

      if (cmds.length === 0) {
        return await sock.sendMessage(from, { text: `⚠️ Belum ada perintah di kategori *${categoryInput}*.` });
      }

      // Format List
      const headerMap = {
        'class': '🏫 MANAJEMEN KELAS',
        'semester': '📅 SEMESTER UTAMA',
        'subject': '📚 MATA KULIAH',
        'task': '📝 TUGAS & PR',
        'reminder': '🔔 PENGINGAT / REMINDER',
        'member': '👥 MEMBER MANAGEMENT',
        'justForFun': '🤖 AI & HIBURAN',
        'group': '🌐 GROUP UTILITIES',
        'admin': '👮 ADMIN TOOLS'
      };

      const header = headerMap[targetFolder] || categoryInput.toUpperCase();
      let cmdListText = `╭── [ *${header}* ]\n│\n`;

      // Sort by length of name to look tidy? Or Alphabetical?
      cmds.sort((a, b) => a.name.localeCompare(b.name));

      cmds.forEach(c => {
        cmdListText += `├ \`${c.name}\`\n│ ${c.desc}\n│\n`;
      });

      // Close box
      cmdListText = cmdListText.substring(0, cmdListText.length - 2); // remove last newline+bar
      cmdListText += `\n╰ _Total: ${cmds.length} Perintah_\n\n_Ketik_ \`#help\` _untuk kembali._`;

      const finalMsg = `${header} COMMANDS\n\n${cmdListText}`;

      return await sock.sendMessage(from, { text: finalMsg });
    }

    // --- 3. MENU UTAMA (DEFAULT) ---
    const text = `🤖 *CLASS BOT ASSISTANT*
Halo, *${pushName}*! 👋

Ketik \`#help [kategori]\` untuk melihat perintah.

╭── [ 📌 *DAFTAR KATEGORI* ]
│
├ \`#help setup\` (⭐ PENTING)
│
├ \`#help kelas\`     (Manajemen Kelas)
├ \`#help semester\`  (Semester Kuliah)
├ \`#help mapel\`     (Mata Kuliah)
├ \`#help tugas\`     (Tugas/PR)
├ \`#help reminder\`  (Pengingat)
├ \`#help member\`    (Data Mahasiswa)
├ \`#help util\`      (Tagging, Sticker, dll)
├ \`#help fun\`       (AI, Games, Hiburan)
│
╰ \`#help community\` (Grup Community)

──────────────
*Dynamic Command List v2.0*`;

    await sock.sendMessage(from, {
      text: text,
      mentions: [sender]
    });
  },
};
