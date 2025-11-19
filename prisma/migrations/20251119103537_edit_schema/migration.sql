/*
  Warnings:

  - You are about to drop the column `semester_id` on the `classes` table. All the data in the column will be lost.
  - Added the required column `wa_group_id` to the `group_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `class_id` to the `semesters` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_classes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_classes" ("created_at", "description", "group_id", "id", "name", "updated_at") SELECT "created_at", "description", "group_id", "id", "name", "updated_at" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_group_id_key" ON "classes"("group_id");
CREATE TABLE "new_group_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "judul" TEXT NOT NULL,
    "wa_group_id" TEXT NOT NULL,
    "class_id" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_group_assignments" ("class_id", "createdAt", "id", "judul") SELECT "class_id", "createdAt", "id", "judul" FROM "group_assignments";
DROP TABLE "group_assignments";
ALTER TABLE "new_group_assignments" RENAME TO "group_assignments";
CREATE TABLE "new_semesters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "class_id" INTEGER NOT NULL,
    CONSTRAINT "semesters_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_semesters" ("id", "isActive", "name") SELECT "id", "isActive", "name" FROM "semesters";
DROP TABLE "semesters";
ALTER TABLE "new_semesters" RENAME TO "semesters";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
