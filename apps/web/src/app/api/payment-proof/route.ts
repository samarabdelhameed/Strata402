import { NextResponse } from "next/server";
import { readGateway } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readGateway("/v1/payment-proof"));
}