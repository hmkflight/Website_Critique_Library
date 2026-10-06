import { errorResponse } from "@/lib/api";
import { SCREENSHOT_ID_PATTERN } from "@/lib/schema";
import { readScreenshot } from "@/lib/storage";

/** Serves images only by manifest id; the client never supplies a path. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[slug]/screenshots/[id]">) {
  try {
    const { slug, id } = await ctx.params;
    if (!SCREENSHOT_ID_PATTERN.test(id)) return new Response("Not found", { status: 404 });
    const { data, mime } = await readScreenshot(slug, id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
