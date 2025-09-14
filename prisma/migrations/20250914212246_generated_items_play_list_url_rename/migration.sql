/*
  Warnings:

  - You are about to drop the column `playlistUrl` on the `user_play_blocks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."user_play_blocks" DROP COLUMN "playlistUrl",
ADD COLUMN     "playlist_url" TEXT;
