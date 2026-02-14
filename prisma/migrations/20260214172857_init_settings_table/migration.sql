/*
  Warnings:

  - You are about to drop the column `gridColumns` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `gridRows` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `showTitle` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `titleText` on the `Settings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'INSTAGRAM''DA BİZ',
    "subheading" TEXT NOT NULL DEFAULT 'Daha Fazlası İçin Bizi Takip Edebilirsiniz',
    "feedType" TEXT NOT NULL DEFAULT 'slider',
    "showPinnedReels" BOOLEAN NOT NULL DEFAULT false,
    "desktopColumns" INTEGER NOT NULL DEFAULT 4,
    "mobileColumns" INTEGER NOT NULL DEFAULT 2,
    "showArrows" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("id", "shop", "updatedAt") SELECT "id", "shop", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
