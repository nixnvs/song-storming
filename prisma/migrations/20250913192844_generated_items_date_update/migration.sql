/*
  Warnings:

  - Changed the type of `date_iso` on the `generated_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."generated_items" DROP COLUMN "date_iso",
ADD COLUMN     "date_iso" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "generated_items_date_iso_block_id_idx" ON "public"."generated_items"("date_iso", "block_id");
