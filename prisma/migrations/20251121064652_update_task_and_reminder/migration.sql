/*
  Warnings:

  - You are about to drop the column `reminderSent` on the `tasks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "repeatInterval" TEXT;
ALTER TABLE "reminders" ADD COLUMN "repeatUntil" DATETIME;

-- CreateTable
CREATE TABLE "task_reminder_status" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "reminderType" TEXT NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "task_reminder_status_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mapel" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "isGroupTask" BOOLEAN NOT NULL DEFAULT false,
    "class_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("class_id", "created_at", "deadline", "id", "judul", "link", "mapel", "status") SELECT "class_id", "created_at", "deadline", "id", "judul", "link", "mapel", "status" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "task_reminder_status_taskId_reminderType_key" ON "task_reminder_status"("taskId", "reminderType");
