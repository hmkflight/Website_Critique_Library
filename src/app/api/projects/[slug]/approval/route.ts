import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/api";
import { approvalInput } from "@/lib/schema";
import { setApproval } from "@/lib/storage";

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[slug]/approval">) {
  try {
    const { slug } = await ctx.params;
    const input = approvalInput.parse(await readJsonBody(req));
    return NextResponse.json(await setApproval(slug, input.baseVersion, input.action, input.rationale));
  } catch (e) {
    return errorResponse(e);
  }
}
