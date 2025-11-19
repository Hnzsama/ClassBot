-- CreateTable
CREATE TABLE "group_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "judul" TEXT NOT NULL,
    "wa_group_id" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sub_groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "namaSubGrup" TEXT NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    CONSTRAINT "sub_groups_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "group_assignments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_MemberSubGroups" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_MemberSubGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MemberSubGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "sub_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_MemberSubGroups_AB_unique" ON "_MemberSubGroups"("A", "B");

-- CreateIndex
CREATE INDEX "_MemberSubGroups_B_index" ON "_MemberSubGroups"("B");
