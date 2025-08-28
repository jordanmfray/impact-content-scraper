-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "images" TEXT[],
ALTER COLUMN "status" SET DEFAULT 'draft';
