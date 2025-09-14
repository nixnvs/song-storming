-- CreateTable
CREATE TABLE "public"."generated_items" (
    "id" SERIAL NOT NULL,
    "guid" UUID NOT NULL,
    "track_id" INTEGER NOT NULL,
    "artist" TEXT NOT NULL,
    "block_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "date_iso" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generated_items_guid_key" ON "public"."generated_items"("guid");

-- AddForeignKey
ALTER TABLE "public"."generated_items" ADD CONSTRAINT "generated_items_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_items" ADD CONSTRAINT "generated_items_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."play_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
