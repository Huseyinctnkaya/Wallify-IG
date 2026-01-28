-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "gridColumns" INTEGER NOT NULL DEFAULT 4,
    "gridRows" INTEGER NOT NULL DEFAULT 2,
    "showTitle" BOOLEAN NOT NULL DEFAULT true,
    "titleText" TEXT NOT NULL DEFAULT 'Instagram Feed',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_shop_key" ON "InstagramAccount"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
