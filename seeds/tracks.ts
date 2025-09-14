import prisma from "../api/utils/prisma-client";
import { Prisma } from "@prisma/client";
import csvToJson from "convert-csv-to-json";

function getTracks(): Prisma.tracksCreateManyInput[] {
  const tracks = csvToJson
    .fieldDelimiter(",")
    .getJsonFromCsv("temp/tracks.csv");

  return tracks.map((track) => ({
    uri: track["Track URI"],
    name: track["Track Name"],
    album_name: track["Album Name"],
    artists: track["Artist Name(s)"],
    release_date: track["Release Date"],
    duration_ms: track["Duration (ms)"],
    popularity: track["Popularity"],
    explicit: track["Explicit"] === "FALSE" ? false : true,
    added_by: track["Added By"],
    added_at: track["Added At"],
    genres: track["Genres"],
    record_label: track["Record Label"],
    danceability: Prisma.Decimal(track["Danceability"]),
    energy: track["Energy"],
    key: track["Key"],
    loudness: track["Loudness"],
    mode: track["Mode"],
    speechiness: track["Speechiness"],
    acousticness: track["Acousticness"],
    instrumentalness: track["Instrumentalness"],
    liveness: track["Liveness"],
    valence: track["Valence"],
    tempo: track["Tempo"],
    time_signature: track["Time Signature"],
  }));
}

const generateTracks = async () => {
  try {
    const tracks = getTracks();
    await prisma.tracks.createMany({
      data: tracks,
    });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
};

generateTracks();
