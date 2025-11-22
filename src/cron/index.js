// src/cron/index.js
const initTaskReminder = require("./taskReminder");
const initGeneralReminder = require("./generalReminder");
const initAutoUpdateTask = require("./autoUpdateTask");

function initCronJobs(bot) {
  console.log("\n⏰ Initializing Cron Jobs...");
  
  // 1. Jalankan Cron Task (H-1)
  initTaskReminder(bot);
  
  // 2. Jalankan Cron General (#reminder)
  initGeneralReminder(bot);

  // 3. Jalankan Cron Auto Update Task
  initAutoUpdateTask(bot);
  
  console.log("✨ All Cron Jobs are running.\n");
}

module.exports = { initCronJobs };