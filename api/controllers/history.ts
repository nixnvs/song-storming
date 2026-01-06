import prisma from "../utils/prisma-client";

type HistoryResponse = {
  id: number;
  date: string;
  block: string;
  startTime: string | null;
  endTime: string | null;
  duration: string | null;
  tracksPlayed: number;
  avgEnergy: number | null;
  avgBpm: number | null;
  exported: boolean;
  playlist: {
    artist: string;
    track: string;
    duration: string;
    bpm: number | null;
    energy: number | null;
  }[];
};

function msToMinutes(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function minutesDiff(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? `${diff} minutes` : null;
}

export async function getUserPlayHistory(
  userId: number
): Promise<HistoryResponse[]> {
  const items = await prisma.generated_items.findMany({
    where: { user_id: userId },
    include: {
      tracks: true,
      play_blocks: true,
    },
    orderBy: { date_iso: "desc" },
  });

  // Group by date + block
  const grouped: Record<string, HistoryResponse> = {};

  items.forEach((item) => {
    const date = item.date_iso.toISOString().split("T")[0];
    const key = `${date}-${item.block_id}`;

    if (!grouped[key]) {
      grouped[key] = {
        id: item.block_id,
        date,
        block: item.play_blocks?.name ?? "Unknown",
        startTime: item.play_blocks?.start_time ?? null,
        endTime: item.play_blocks?.end_time ?? null,
        duration: minutesDiff(
          item.play_blocks?.start_time ?? null,
          item.play_blocks?.end_time ?? null
        ),
        tracksPlayed: 0,
        avgEnergy: 0,
        avgBpm: 0,
        exported: false,
        playlist: [],
      };
    }

    grouped[key].tracksPlayed++;
    grouped[key].playlist.push({
      artist: item.artist,
      track: item.tracks.name,
      duration: msToMinutes(Number(item.tracks.duration_ms)),
      bpm: item.tracks.tempo ? Number(item.tracks.tempo) : null,
      energy: item.tracks.energy ? Number(item.tracks.energy) : null,
    });
  });

  // Post-processing averages + exported flag
  Object.values(grouped).forEach((entry) => {
    const energies = entry.playlist.map((p) => p.energy ?? 0);
    const bpms = entry.playlist.map((p) => p.bpm ?? 0);

    entry.avgEnergy = energies.length
      ? Number(
          (energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(2)
        )
      : null;
    entry.avgBpm = bpms.length
      ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)
      : null;
    entry.exported = entry.playlist.length > 0; // tweak logic if you have export flag
  });

  return Object.values(grouped);
}
