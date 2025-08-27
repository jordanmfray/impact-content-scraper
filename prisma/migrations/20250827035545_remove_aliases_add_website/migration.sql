/*
  Warnings:

  - You are about to drop the `OrgAlias` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."OrgAlias" DROP CONSTRAINT "OrgAlias_organizationId_fkey";

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "website" TEXT;

-- DropTable
DROP TABLE "public"."OrgAlias";
