import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/api";
import { createProjectInput } from "@/lib/schema";
import { createProject } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const input = createProjectInput.parse(await readJsonBody(req));
    const project = await createProject(input);
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
