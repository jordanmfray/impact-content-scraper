/*
  Warnings:

  - You are about to drop the column `discoveryId` on the `Enrichment` table. All the data in the column will be lost.
  - You are about to drop the column `discoveryId` on the `RawDocument` table. All the data in the column will be lost.
  - You are about to drop the `ArticleSignal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DiscoveryResult` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentEmbedding` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[articleId]` on the table `Enrichment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[articleId]` on the table `RawDocument` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `articleId` to the `Enrichment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `articleId` to the `RawDocument` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Enrichment_discoveryId_key";

-- DropIndex
DROP INDEX "public"."RawDocument_discoveryId_key";

-- AlterTable
ALTER TABLE "public"."Enrichment" DROP COLUMN "discoveryId",
ADD COLUMN     "articleId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."RawDocument" DROP COLUMN "discoveryId",
ADD COLUMN     "articleId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."ArticleSignal";

-- DropTable
DROP TABLE "public"."DiscoveryResult";

-- DropTable
DROP TABLE "public"."DocumentEmbedding";

-- CreateIndex
CREATE UNIQUE INDEX "Enrichment_articleId_key" ON "public"."Enrichment"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "RawDocument_articleId_key" ON "public"."RawDocument"("articleId");

-- AddForeignKey
ALTER TABLE "public"."RawDocument" ADD CONSTRAINT "RawDocument_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrichment" ADD CONSTRAINT "Enrichment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
