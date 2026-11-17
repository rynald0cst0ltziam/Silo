import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getUser() {
  const { userId } = await auth();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  });
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
