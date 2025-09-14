-- AlterTable
ALTER TABLE "public"."generated_items" ALTER COLUMN "date_iso" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "generated_items_date_iso_block_id_idx" ON "public"."generated_items"("date_iso", "block_id");
