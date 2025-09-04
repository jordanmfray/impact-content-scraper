-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inspirationRating" TEXT,
ADD COLUMN     "organizationRelevance" TEXT,
ADD COLUMN     "organizationSentiment" TEXT,
ADD COLUMN     "validationReasons" TEXT[];

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "newsUrl" TEXT;

-- CreateTable
CREATE TABLE "public"."UrlDiscoveryBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timeframe" INTEGER NOT NULL,
    "discoveredUrls" TEXT[],
    "totalUrls" INTEGER NOT NULL DEFAULT 0,
    "processedUrls" INTEGER NOT NULL DEFAULT 0,
    "successfulUrls" INTEGER NOT NULL DEFAULT 0,
    "failedUrls" INTEGER NOT NULL DEFAULT 0,
    "processingResults" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveredAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UrlDiscoveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrlDiscoveryBatch_organizationId_idx" ON "public"."UrlDiscoveryBatch"("organizationId");

-- CreateIndex
CREATE INDEX "UrlDiscoveryBatch_status_idx" ON "public"."UrlDiscoveryBatch"("status");

-- CreateIndex
CREATE INDEX "UrlDiscoveryBatch_startedAt_idx" ON "public"."UrlDiscoveryBatch"("startedAt");

-- AddForeignKey
ALTER TABLE "public"."UrlDiscoveryBatch" ADD CONSTRAINT "UrlDiscoveryBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
