import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect(new URL("/silo-connector.zip", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
