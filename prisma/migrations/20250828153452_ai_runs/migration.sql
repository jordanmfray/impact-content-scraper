-- CreateTable
CREATE TABLE "public"."AiRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "inputUrl" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stepsData" JSONB NOT NULL,
    "articleId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRun_status_idx" ON "public"."AiRun"("status");

-- CreateIndex
CREATE INDEX "AiRun_startedAt_idx" ON "public"."AiRun"("startedAt");

-- CreateIndex
CREATE INDEX "AiRun_organizationId_idx" ON "public"."AiRun"("organizationId");

-- AddForeignKey
ALTER TABLE "public"."AiRun" ADD CONSTRAINT "AiRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiRun" ADD CONSTRAINT "AiRun_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
