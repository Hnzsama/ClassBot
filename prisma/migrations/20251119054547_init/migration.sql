-- CreateTable
CREATE TABLE "members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nim" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "panggilan" TEXT,
    "nama_kelas" TEXT,
    "group_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "members_nim_key" ON "members"("nim");
