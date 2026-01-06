import prisma from "../api/utils/prisma-client";
import { Prisma } from "@prisma/client";

const defaultPlayBlocks: Prisma.play_blocksCreateInput[] = [
  {
    name: "Lunch",
    target_min: 90,
    target_max: 120,
    bpm_min: 60,
    bpm_max: 95,
    energy_min: new Prisma.Decimal("0.1"), // <-- use Decimal or string
    energy_max: new Prisma.Decimal("0.4"),
    prefer_instrumental: true,
    start_time: "12:00",
    end_time: "14:30",
  },
  {
    name: "Dinner",
    target_min: 120,
    target_max: 150,
    bpm_min: 80,
    bpm_max: 110,
    energy_min: new Prisma.Decimal("0.3"),
    energy_max: new Prisma.Decimal("0.6"),
    prefer_instrumental: false,
    start_time: "19:00",
    end_time: "22:00",
  },
  {
    name: "Late",
    target_min: 90,
    target_max: 120,
    bpm_min: 60,
    bpm_max: 90,
    energy_min: new Prisma.Decimal("0.2"),
    energy_max: new Prisma.Decimal("0.5"),
    prefer_instrumental: false,
    start_time: "22:00",
    end_time: "00:00",
  },
];

const generatePlayBlocks = async () => {
  try {
    for (const block of defaultPlayBlocks) {
      await prisma.play_blocks.create({ data: block });
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
};

generatePlayBlocks();
