-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrgAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "OrgAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrgKeyword" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "OrgKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscoveryResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "DiscoveryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RawDocument" (
    "id" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "html" TEXT,
    "markdown" TEXT,
    "text" TEXT,
    "httpStatus" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Enrichment" (
    "id" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "summary" TEXT,
    "keywords" TEXT[],
    "sentiment" TEXT,
    "entitiesJson" JSONB,
    "canonicalUrl" TEXT,

    CONSTRAINT "Enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ArticleSignal" (
    "id" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL,
    "duplicateOf" TEXT,
    "publishable" BOOLEAN NOT NULL,

    CONSTRAINT "ArticleSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentEmbedding" (
    "id" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "dim" INTEGER NOT NULL,
    "embedding" BYTEA NOT NULL,

    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryResult_hash_key" ON "public"."DiscoveryResult"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "RawDocument_discoveryId_key" ON "public"."RawDocument"("discoveryId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrichment_discoveryId_key" ON "public"."Enrichment"("discoveryId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSignal_discoveryId_key" ON "public"."ArticleSignal"("discoveryId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentEmbedding_discoveryId_key" ON "public"."DocumentEmbedding"("discoveryId");

-- AddForeignKey
ALTER TABLE "public"."OrgAlias" ADD CONSTRAINT "OrgAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgKeyword" ADD CONSTRAINT "OrgKeyword_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
