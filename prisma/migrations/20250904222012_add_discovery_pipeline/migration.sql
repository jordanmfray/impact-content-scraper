-- CreateTable
CREATE TABLE "public"."DiscoverySession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "newsUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'discovering',
    "totalUrls" INTEGER NOT NULL DEFAULT 0,
    "selectedUrls" INTEGER NOT NULL DEFAULT 0,
    "processedUrls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscoveredUrl" (
    "id" TEXT NOT NULL,
    "discoverySessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlType" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "titlePreview" TEXT,
    "selectedForScraping" BOOLEAN NOT NULL DEFAULT false,
    "scrapeStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScrapedContent" (
    "id" TEXT NOT NULL,
    "discoveredUrlId" TEXT NOT NULL,
    "discoverySessionId" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "markdownContent" TEXT,
    "keywords" TEXT[],
    "sentimentScore" INTEGER,
    "sentimentReasoning" TEXT,
    "selectedForFinalization" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PipelineArticle" (
    "id" TEXT NOT NULL,
    "scrapedContentId" TEXT NOT NULL,
    "discoverySessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "finalTitle" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ogImage" TEXT,
    "extractedImages" TEXT[],
    "keywords" TEXT[],
    "sentimentScore" INTEGER,
    "urlType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoverySession_organizationId_idx" ON "public"."DiscoverySession"("organizationId");

-- CreateIndex
CREATE INDEX "DiscoverySession_status_idx" ON "public"."DiscoverySession"("status");

-- CreateIndex
CREATE INDEX "DiscoveredUrl_discoverySessionId_idx" ON "public"."DiscoveredUrl"("discoverySessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedContent_discoveredUrlId_key" ON "public"."ScrapedContent"("discoveredUrlId");

-- CreateIndex
CREATE INDEX "ScrapedContent_discoverySessionId_idx" ON "public"."ScrapedContent"("discoverySessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineArticle_scrapedContentId_key" ON "public"."PipelineArticle"("scrapedContentId");

-- CreateIndex
CREATE INDEX "PipelineArticle_discoverySessionId_idx" ON "public"."PipelineArticle"("discoverySessionId");

-- CreateIndex
CREATE INDEX "PipelineArticle_organizationId_idx" ON "public"."PipelineArticle"("organizationId");

-- AddForeignKey
ALTER TABLE "public"."DiscoverySession" ADD CONSTRAINT "DiscoverySession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscoveredUrl" ADD CONSTRAINT "DiscoveredUrl_discoverySessionId_fkey" FOREIGN KEY ("discoverySessionId") REFERENCES "public"."DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapedContent" ADD CONSTRAINT "ScrapedContent_discoveredUrlId_fkey" FOREIGN KEY ("discoveredUrlId") REFERENCES "public"."DiscoveredUrl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScrapedContent" ADD CONSTRAINT "ScrapedContent_discoverySessionId_fkey" FOREIGN KEY ("discoverySessionId") REFERENCES "public"."DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PipelineArticle" ADD CONSTRAINT "PipelineArticle_scrapedContentId_fkey" FOREIGN KEY ("scrapedContentId") REFERENCES "public"."ScrapedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PipelineArticle" ADD CONSTRAINT "PipelineArticle_discoverySessionId_fkey" FOREIGN KEY ("discoverySessionId") REFERENCES "public"."DiscoverySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PipelineArticle" ADD CONSTRAINT "PipelineArticle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
