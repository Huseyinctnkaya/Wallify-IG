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
    "onClick" TEXT NOT NULL DEFAULT 'popup',
    "postSpacing" TEXT NOT NULL DEFAULT 'medium',
    "borderRadius" TEXT NOT NULL DEFAULT 'medium',
    "playVideoOnHover" BOOLEAN NOT NULL DEFAULT false,
    "showThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "showViewsCount" BOOLEAN NOT NULL DEFAULT false,
    "showAuthorProfile" BOOLEAN NOT NULL DEFAULT true,
    "showAttachedProducts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("desktopColumns", "feedType", "id", "mobileColumns", "shop", "showArrows", "showPinnedReels", "subheading", "title", "updatedAt") SELECT "desktopColumns", "feedType", "id", "mobileColumns", "shop", "showArrows", "showPinnedReels", "subheading", "title", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
