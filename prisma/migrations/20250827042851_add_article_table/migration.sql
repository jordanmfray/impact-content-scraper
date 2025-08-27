-- CreateTable
CREATE TABLE "public"."Article" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "ogImage" TEXT,
    "sentiment" TEXT,
    "keywords" TEXT[],
    "canonicalUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "public"."Article"("url");

-- CreateIndex
CREATE INDEX "Article_organizationId_idx" ON "public"."Article"("organizationId");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "public"."Article"("publishedAt");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "public"."Article"("status");

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
