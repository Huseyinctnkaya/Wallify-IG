-- Add configurable CTA button text for feed and preview
ALTER TABLE "Settings"
ADD COLUMN "buttonText" TEXT NOT NULL DEFAULT 'Open in Instagram';
