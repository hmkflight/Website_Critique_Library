import { NextResponse } from "next/server";
import { z } from "zod";

/** Map storage errors to JSON responses without leaking filesystem details. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid input.", fields: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  const status = (e as { status?: number }).status;
  if (status === 400 || status === 404 || status === 409) {
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
  console.error(e);
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw Object.assign(new Error("Request body must be JSON."), { status: 400 });
  }
}
