/*
  Warnings:

  - You are about to drop the column `group_id` on the `classes` table. All the data in the column will be lost.
  - Added the required column `main_group_id` to the `classes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "attachmentData" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_classes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "main_group_id" TEXT NOT NULL,
    "input_group_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_classes" ("created_at", "description", "id", "name", "updated_at") SELECT "created_at", "description", "id", "name", "updated_at" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_main_group_id_key" ON "classes"("main_group_id");
CREATE UNIQUE INDEX "classes_input_group_id_key" ON "classes"("input_group_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
