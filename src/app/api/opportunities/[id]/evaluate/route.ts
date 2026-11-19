import { NextResponse, type NextRequest } from "next/server";
import { isClaudeConfigured } from "@/lib/evaluation/claude";
import { reevaluate } from "@/lib/scan";
import { getOpportunity } from "@/lib/store";

export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isClaudeConfigured()) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 400 });
  const { id } = await ctx.params;
  const o = await getOpportunity(decodeURIComponent(id));
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(await reevaluate(o));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
