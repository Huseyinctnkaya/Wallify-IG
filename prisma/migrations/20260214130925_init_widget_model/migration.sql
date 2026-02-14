/*
  Warnings:

  - You are about to drop the `Settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Settings";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My Feed Widget',
    "type" TEXT NOT NULL DEFAULT 'feed',
    "status" TEXT NOT NULL DEFAULT 'active',
    "configuration" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
