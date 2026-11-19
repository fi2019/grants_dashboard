import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateDecision } from "@/lib/store";
import { STAGES } from "@/lib/types";

const Patch = z.object({
  stage: z.enum(STAGES).optional(),
  owner: z.string().max(120).nullable().optional(),
  notes: z.string().max(20_000).optional(),
  internalReviewDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const updated = await updateDecision(decodeURIComponent(id), parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
