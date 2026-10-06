import { NextResponse } from "next/server";
import { errorResponse, readJsonBody } from "@/lib/api";
import { notesInput } from "@/lib/schema";
import { NOTE_FILES, saveNote, type NoteKind } from "@/lib/storage";

export async function PUT(req: Request, ctx: RouteContext<"/api/projects/[slug]/notes/[kind]">) {
  try {
    const { slug, kind } = await ctx.params;
    if (!(kind in NOTE_FILES)) return NextResponse.json({ error: "Unknown note." }, { status: 404 });
    const input = notesInput.parse(await readJsonBody(req));
    return NextResponse.json(await saveNote(slug, kind as NoteKind, input.baseVersion, input.content));
  } catch (e) {
    return errorResponse(e);
  }
}
