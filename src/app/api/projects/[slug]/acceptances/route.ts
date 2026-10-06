import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/api";
import { acceptanceInput } from "@/lib/schema";
import { setAcceptance } from "@/lib/storage";

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[slug]/acceptances">) {
  try {
    const { slug } = await ctx.params;
    const input = acceptanceInput.parse(await readJsonBody(req));
    return NextResponse.json(await setAcceptance(slug, input.baseVersion, input.findingId, input.rationale));
  } catch (e) {
    return errorResponse(e);
  }
}
