import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!SIGNING_SECRET) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const wh = new Webhook(SIGNING_SECRET);
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (evt.type) {
    case "user.created": {
      const { id, email_addresses } = evt.data;
      const primaryEmail = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id
      );
      if (!primaryEmail) break;

      await prisma.user.upsert({
        where: { clerkId: id },
        update: { email: primaryEmail.email_address },
        create: {
          clerkId: id,
          email: primaryEmail.email_address,
        },
      });
      break;
    }

    case "user.updated": {
      const { id, email_addresses } = evt.data;
      const primaryEmail = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id
      );
      if (!primaryEmail) break;

      await prisma.user.upsert({
        where: { clerkId: id },
        update: { email: primaryEmail.email_address },
        create: {
          clerkId: id,
          email: primaryEmail.email_address,
        },
      });
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;
      if (!id) break;
      await prisma.user.deleteMany({ where: { clerkId: id } });
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
