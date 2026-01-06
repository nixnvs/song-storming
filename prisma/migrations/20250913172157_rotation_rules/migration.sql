-- CreateTable
CREATE TABLE "public"."rotation_rules" (
    "id" SERIAL NOT NULL,
    "guid" UUID NOT NULL,
    "track_cooldown_days" INTEGER NOT NULL,
    "artist_cooldown_min" INTEGER NOT NULL,
    "exclude_explicit" BOOLEAN NOT NULL,
    "normalize_loudness" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "play_blocksId" INTEGER,

    CONSTRAINT "rotation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rotation_rules_guid_key" ON "public"."rotation_rules"("guid");

-- AddForeignKey
ALTER TABLE "public"."rotation_rules" ADD CONSTRAINT "rotation_rules_play_blocksId_fkey" FOREIGN KEY ("play_blocksId") REFERENCES "public"."play_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
