import { users } from "@prisma/client";
import prisma from "../utils/prisma-client";

type UserImage = {
  url: string;
  height: number;
  width: number;
};

export interface SpotifyUser {
  country: string;
  display_name: string;
  email: string;
  explicit_content: {
    filter_enabled: false;
    filter_locked: false;
  };
  external_urls: {
    spotify: string;
  };
  followers: {
    href: string;
    total: number;
  };
  href: string;
  id: string;
  images: UserImage[];
  product: string;
  type: string;
  uri: string;
}

export async function createUser(user: SpotifyUser) {
  const existingUser = await prisma.users.findUnique({
    where: {
      spotify_id: user.id,
    },
  });
  if (existingUser) {
    return existingUser;
  }
  await prisma.users.create({
    data: {
      spotify_id: user.id,
      email: user.email,
      name: user.display_name,
      ...(user?.images?.length && { image: user?.images?.[0]?.url ?? "" }),
    },
  });
}

export async function getRegisteredUser(
  spotifyId: string
): Promise<users | null> {
  const user = await prisma.users.findUnique({
    where: {
      spotify_id: spotifyId,
    },
  });
  return user;
}

export async function createUserPlayBlock(userId: number, blockName: string) {
  const playBlock = await prisma.play_blocks.findFirst({
    where: {
      name: blockName,
    },
  });
  if (!playBlock) {
    return null;
  }

  await prisma.user_play_blocks.create({
    data: {
      user_id: userId,
      play_block_id: playBlock.id,
    },
  });
}
