-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'ARCHIVE', 'OTHER');

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "MediaCategory" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_file_path_key" ON "media"("file_path");

-- CreateIndex
CREATE INDEX "media_category_idx" ON "media"("category");

-- CreateIndex
CREATE INDEX "media_created_at_idx" ON "media"("created_at");

-- CreateIndex
CREATE INDEX "media_tags_idx" ON "media" USING GIN ("tags");
