-- CreateTable
CREATE TABLE "semesters" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "semester_id" INTEGER NOT NULL,
    CONSTRAINT "subjects_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_classes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "semester_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "classes_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_classes" ("created_at", "description", "group_id", "id", "name", "updated_at") SELECT "created_at", "description", "group_id", "id", "name", "updated_at" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_group_id_key" ON "classes"("group_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
