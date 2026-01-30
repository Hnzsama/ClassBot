const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'followUpTasks.json');

// Ensure file exists
if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2));
}

function getQueue() {
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading task queue:", err);
        return [];
    }
}

function saveQueue(queue) {
    try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(queue, null, 2));
    } catch (err) {
        console.error("Error saving task queue:", err);
    }
}

function addTask(task) {
    const queue = getQueue();
    // task: { id, targetNumber, scheduledTime, context, createdAt }
    queue.push({
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...task
    });
    saveQueue(queue);
    console.log(`[QUEUE] Task added for ${task.targetNumber} at ${task.scheduledTime}`);
}

function popDueTasks() {
    const queue = getQueue();
    const now = new Date();

    const due = [];
    const pending = [];

    queue.forEach(task => {
        if (new Date(task.scheduledTime) <= now) {
            due.push(task);
        } else {
            pending.push(task);
        }
    });

    if (due.length > 0) {
        saveQueue(pending); // Remove due tasks from file
    }

    return due;
}

module.exports = { addTask, popDueTasks, getQueue };
