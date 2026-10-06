import { imageSize } from "image-size";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { screenshotUploadInput } from "@/lib/schema";
import { MAX_UPLOAD_BYTES, addScreenshot, sniffImage } from "@/lib/storage";

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[slug]/screenshots">) {
  try {
    const { slug } = await ctx.params;
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "Image is larger than 15 MB." }, { status: 413 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Image is larger than 15 MB." }, { status: 413 });
    if (file.size === 0) return NextResponse.json({ error: "The file is empty." }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) return NextResponse.json({ error: "Only PNG, JPEG or WebP images are accepted." }, { status: 415 });
    let dims: { width: number; height: number };
    try {
      const d = imageSize(buf);
      if (!d.width || !d.height) throw new Error();
      dims = { width: d.width, height: d.height };
    } catch {
      return NextResponse.json({ error: "The image could not be read." }, { status: 415 });
    }

    const field = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : undefined;
    };
    const meta = screenshotUploadInput.parse({
      role: field("role"),
      page: field("page"),
      viewportLabel: field("viewportLabel"),
      viewportWidth: field("viewportWidth"),
      viewportHeight: field("viewportHeight"),
      pairId: field("pairId") || undefined,
      revisionId: field("revisionId") || undefined,
      reviewId: field("reviewId") || undefined,
      caption: field("caption") || undefined,
    });
    const result = await addScreenshot(slug, field("baseVersion") ?? "", buf, { ...meta, image: dims, ext: kind.ext });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
