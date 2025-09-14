-- CreateTable
CREATE TABLE "public"."play_blocks" (
    "id" SERIAL NOT NULL,
    "guid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_min" INTEGER NOT NULL,
    "target_max" INTEGER NOT NULL,
    "bpm_min" INTEGER NOT NULL,
    "bpm_max" INTEGER NOT NULL,
    "energy_min" INTEGER NOT NULL,
    "energy_max" INTEGER NOT NULL,
    "prefer_instrumental" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),

    CONSTRAINT "play_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "play_blocks_guid_key" ON "public"."play_blocks"("guid");
