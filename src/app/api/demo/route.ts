import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { installDemo, removeDemo } from "@/lib/demo";

export async function POST() {
  try {
    return NextResponse.json({ installed: await installDemo() }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  try {
    return NextResponse.json({ removed: await removeDemo() });
  } catch (e) {
    return errorResponse(e);
  }
}
