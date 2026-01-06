-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "guid" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "spotify_id" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_play_blocks" (
    "id" SERIAL NOT NULL,
    "guid" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "play_block_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_play_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_guid_key" ON "public"."users"("guid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_spotify_id_key" ON "public"."users"("spotify_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_play_blocks_guid_key" ON "public"."user_play_blocks"("guid");

-- AddForeignKey
ALTER TABLE "public"."user_play_blocks" ADD CONSTRAINT "user_play_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_play_blocks" ADD CONSTRAINT "user_play_blocks_play_block_id_fkey" FOREIGN KEY ("play_block_id") REFERENCES "public"."play_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
