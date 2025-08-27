/*
  Warnings:

  - You are about to drop the `OrgKeyword` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."OrgKeyword" DROP CONSTRAINT "OrgKeyword_organizationId_fkey";

-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "logo" TEXT;

-- DropTable
DROP TABLE "public"."OrgKeyword";
