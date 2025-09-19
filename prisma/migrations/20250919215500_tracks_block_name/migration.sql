-- CreateEnum
CREATE TYPE "public"."BlockName" AS ENUM ('DINNER', 'LUNCH', 'LATE');

-- AlterTable
ALTER TABLE "public"."tracks" ADD COLUMN     "block_name" "public"."BlockName";
