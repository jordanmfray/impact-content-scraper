/*
  Warnings:

  - You are about to drop the column `bannerImage` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `logo` on the `Organization` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Organization" DROP COLUMN "bannerImage",
DROP COLUMN "logo";
