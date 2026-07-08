CREATE TABLE "HomeOffer" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "buttonLabel" TEXT DEFAULT 'Claim',
    "code" TEXT,
    "icon" TEXT DEFAULT 'tag',
    "color" TEXT DEFAULT '#E30613',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeOffer_isActive_sortOrder_idx" ON "HomeOffer"("isActive", "sortOrder");
