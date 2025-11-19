/*
  Warnings:

  - The primary key for the `tasks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `tasks` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
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
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "class_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("class_id", "created_at", "deadline", "id", "judul", "link", "mapel", "reminderSent", "status") SELECT "class_id", "created_at", "deadline", "id", "judul", "link", "mapel", "reminderSent", "status" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
