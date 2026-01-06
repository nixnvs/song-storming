import prisma from "../api/utils/prisma-client";
import { Prisma } from "@prisma/client";

const defaultRotationRules: Prisma.rotation_rulesCreateInput[] = [
  {
    track_cooldown_days: 14,
    artist_cooldown_min: 5,
    exclude_explicit: true,
    normalize_loudness: true,
    play_blocks: {
      connect: {
        id: 1,
      },
    },
  },
  {
    track_cooldown_days: 14,
    artist_cooldown_min: 5,
    exclude_explicit: true,
    normalize_loudness: true,
    play_blocks: {
      connect: {
        id: 2,
      },
    },
  },
  {
    track_cooldown_days: 21,
    artist_cooldown_min: 6,
    exclude_explicit: true,
    normalize_loudness: true,
    play_blocks: {
      connect: {
        id: 3,
      },
    },
  },
];

const generateRotationRules = async () => {
  try {
    for (const block of defaultRotationRules) {
      await prisma.rotation_rules.create({ data: block });
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
};

generateRotationRules();
