-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "profilePictureUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAnalytics" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "permalink" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "products" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_shop_key" ON "InstagramAccount"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_shop_date_key" ON "Analytics"("shop", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PostAnalytics_shop_mediaId_key" ON "PostAnalytics"("shop", "mediaId");

-- CreateIndex
CREATE INDEX "Post_shop_idx" ON "Post"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Post_shop_mediaId_key" ON "Post"("shop", "mediaId");

