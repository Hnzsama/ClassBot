-- CreateTable
CREATE TABLE "reminders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pesan" TEXT NOT NULL,
    "waktu" DATETIME NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sender" TEXT,
    "class_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminders_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
