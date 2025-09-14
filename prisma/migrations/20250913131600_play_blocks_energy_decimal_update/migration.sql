/*
  Warnings:

  - You are about to alter the column `energy_min` on the `play_blocks` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `energy_max` on the `play_blocks` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.

*/
-- AlterTable
ALTER TABLE "public"."play_blocks" ALTER COLUMN "energy_min" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "energy_max" SET DATA TYPE DECIMAL(65,30);
