-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "ein" TEXT,
ADD COLUMN     "guidestarUrl" TEXT,
ADD COLUMN     "tags" TEXT[];
