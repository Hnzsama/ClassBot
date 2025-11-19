/*
  Warnings:

  - You are about to drop the column `wa_group_id` on the `group_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `members` table. All the data in the column will be lost.
  - You are about to drop the column `nama_kelas` on the `members` table. All the data in the column will be lost.
  - Added the required column `class_id` to the `group_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `class_id` to the `members` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "classes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_group_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "judul" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_group_assignments" ("createdAt", "id", "judul") SELECT "createdAt", "id", "judul" FROM "group_assignments";
DROP TABLE "group_assignments";
ALTER TABLE "new_group_assignments" RENAME TO "group_assignments";
CREATE TABLE "new_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nim" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "panggilan" TEXT,
    "class_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "members_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_members" ("created_at", "id", "nama", "nim", "panggilan", "updated_at") SELECT "created_at", "id", "nama", "nim", "panggilan", "updated_at" FROM "members";
DROP TABLE "members";
ALTER TABLE "new_members" RENAME TO "members";
CREATE UNIQUE INDEX "members_nim_key" ON "members"("nim");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "classes_group_id_key" ON "classes"("group_id");
