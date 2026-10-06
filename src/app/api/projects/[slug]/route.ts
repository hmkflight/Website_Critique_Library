import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/api";
import { updateProjectInput } from "@/lib/schema";
import { updateProject } from "@/lib/storage";

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[slug]">) {
  try {
    const { slug } = await ctx.params;
    const { baseVersion, ...patch } = updateProjectInput.parse(await readJsonBody(req));
    return NextResponse.json(await updateProject(slug, baseVersion, patch));
  } catch (e) {
    return errorResponse(e);
  }
}
