-- CreateTable
CREATE TABLE "public"."tracks" (
    "id" SERIAL NOT NULL,
    "uri" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "album_name" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "release_date" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "popularity" INTEGER,
    "explicit" BOOLEAN NOT NULL,
    "added_by" TEXT,
    "added_at" TIMESTAMP(3),
    "genres" TEXT,
    "record_label" TEXT,
    "danceability" DECIMAL(65,30),
    "energy" DECIMAL(65,30),
    "key" INTEGER,
    "loudness" DECIMAL(65,30),
    "mode" INTEGER,
    "speechiness" DECIMAL(65,30),
    "acousticness" DECIMAL(65,30),
    "instrumentalness" DECIMAL(65,30),
    "liveness" DECIMAL(65,30),
    "valence" DECIMAL(65,30),
    "tempo" DECIMAL(65,30),
    "time_signature" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracks_uri_key" ON "public"."tracks"("uri");
