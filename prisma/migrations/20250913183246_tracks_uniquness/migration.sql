/*
  Warnings:

  - A unique constraint covering the columns `[guid]` on the table `tracks` will be added. If there are existing duplicate values, this will fail.
  - The required column `guid` was added to the `tracks` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "public"."tracks_uri_key";

-- AlterTable
ALTER TABLE "public"."tracks" ADD COLUMN     "guid" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tracks_guid_key" ON "public"."tracks"("guid");
