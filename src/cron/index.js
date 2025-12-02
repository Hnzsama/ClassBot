// src/cron/index.js
const initTaskReminder = require("./taskReminder");
const initGeneralReminder = require("./generalReminder");
const initAutoUpdateTask = require("./autoUpdateTask");
const initJam4Sender = require("./jam4Sender");
const initMotivationSender = require("./motivationSender");

function initCronJobs(bot) {
  console.log("\n⏰ Initializing Cron Jobs...");
  
  initTaskReminder(bot);
  initGeneralReminder(bot);
  initAutoUpdateTask(bot);
  initJam4Sender(bot);
  initMotivationSender(bot);
  
  console.log("✨ All Cron Jobs are running.\n");
}

module.exports = { initCronJobs };