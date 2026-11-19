import { NextResponse, type NextRequest } from "next/server";
import { runScan } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

let running: Promise<unknown> | null = null;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  // Browser calls are covered by the dashboard password (src/proxy.ts); schedulers use CRON_SECRET.
  if (secret && auth?.startsWith("Bearer ") && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (running) return NextResponse.json({ error: "A scan is already running" }, { status: 409 });
  try {
    running = runScan();
    return NextResponse.json(await running);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    running = null;
  }
}
