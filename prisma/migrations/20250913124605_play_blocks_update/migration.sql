-- AlterTable
ALTER TABLE "public"."play_blocks" ALTER COLUMN "target_min" DROP NOT NULL,
ALTER COLUMN "target_max" DROP NOT NULL,
ALTER COLUMN "bpm_min" DROP NOT NULL,
ALTER COLUMN "bpm_max" DROP NOT NULL,
ALTER COLUMN "energy_min" DROP NOT NULL,
ALTER COLUMN "energy_max" DROP NOT NULL,
ALTER COLUMN "prefer_instrumental" DROP NOT NULL;
