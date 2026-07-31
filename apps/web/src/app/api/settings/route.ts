import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    settings: getSettings(),
    apiKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function PATCH(request: Request) {
  try {
    const next = updateSettings(await request.json());
    return NextResponse.json({ settings: next });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid settings" },
      { status: 400 },
    );
  }
}
