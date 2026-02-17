-- AlterTable
ALTER TABLE "InstagramAccount" ADD COLUMN "profilePictureUrl" TEXT;

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "products" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'INSTAGRAM''DA BİZ',
    "subheading" TEXT NOT NULL DEFAULT 'Daha Fazlası İçin Bizi Takip Edebilirsiniz',
    "buttonText" TEXT NOT NULL DEFAULT 'Open in Instagram',
    "feedType" TEXT NOT NULL DEFAULT 'slider',
    "showPinnedReels" BOOLEAN NOT NULL DEFAULT false,
    "gridDesktopColumns" INTEGER NOT NULL DEFAULT 4,
    "gridMobileColumns" INTEGER NOT NULL DEFAULT 2,
    "sliderDesktopColumns" INTEGER NOT NULL DEFAULT 4,
    "sliderMobileColumns" INTEGER NOT NULL DEFAULT 2,
    "showArrows" BOOLEAN NOT NULL DEFAULT true,
    "onClick" TEXT NOT NULL DEFAULT 'popup',
    "postSpacing" TEXT NOT NULL DEFAULT 'medium',
    "borderRadius" TEXT NOT NULL DEFAULT 'medium',
    "playVideoOnHover" BOOLEAN NOT NULL DEFAULT false,
    "showThumbnail" BOOLEAN NOT NULL DEFAULT false,
    "showViewsCount" BOOLEAN NOT NULL DEFAULT false,
    "showAuthorProfile" BOOLEAN NOT NULL DEFAULT true,
    "showAttachedProducts" BOOLEAN NOT NULL DEFAULT true,
    "cleanDisplay" BOOLEAN NOT NULL DEFAULT false,
    "titleColor" TEXT NOT NULL DEFAULT '#000000',
    "subheadingColor" TEXT NOT NULL DEFAULT '#6d7175',
    "arrowColor" TEXT NOT NULL DEFAULT '#000000',
    "arrowBackgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "cardUserNameColor" TEXT NOT NULL DEFAULT '#ffffff',
    "cardBadgeBackgroundColor" TEXT NOT NULL DEFAULT 'rgba(0,0,0,0.5)',
    "cardBadgeIconColor" TEXT NOT NULL DEFAULT '#ffffff',
    "mediaLimit" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("arrowBackgroundColor", "arrowColor", "borderRadius", "buttonText", "cardBadgeBackgroundColor", "cardBadgeIconColor", "cardUserNameColor", "feedType", "gridDesktopColumns", "gridMobileColumns", "id", "mediaLimit", "onClick", "playVideoOnHover", "postSpacing", "shop", "showArrows", "showAttachedProducts", "showAuthorProfile", "showPinnedReels", "showThumbnail", "showViewsCount", "sliderDesktopColumns", "sliderMobileColumns", "subheading", "subheadingColor", "title", "titleColor", "updatedAt") SELECT "arrowBackgroundColor", "arrowColor", "borderRadius", "buttonText", "cardBadgeBackgroundColor", "cardBadgeIconColor", "cardUserNameColor", "feedType", "gridDesktopColumns", "gridMobileColumns", "id", "mediaLimit", "onClick", "playVideoOnHover", "postSpacing", "shop", "showArrows", "showAttachedProducts", "showAuthorProfile", "showPinnedReels", "showThumbnail", "showViewsCount", "sliderDesktopColumns", "sliderMobileColumns", "subheading", "subheadingColor", "title", "titleColor", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Post_shop_idx" ON "Post"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Post_shop_mediaId_key" ON "Post"("shop", "mediaId");
