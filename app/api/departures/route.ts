import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { fetchVbb, parseDepartures, VbbError } from "@/lib/vbb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stopId = searchParams.get("stopId");

  if (!stopId) {
    return NextResponse.json(
      { error: "Stop ID parameter is required" },
      { status: 400 }
    );
  }

  try {
    const duration = Math.max(5, Math.min(180, Number(searchParams.get("duration") ?? 40)));
    const data = await fetchVbb(
      `/stops/${encodeURIComponent(stopId)}/departures?duration=${duration}&results=100`
    );
    return NextResponse.json(parseDepartures(data));
  } catch (error) {
    console.error("Error fetching departures:", error);
    if (error instanceof VbbError) {
      return NextResponse.json(
        {
          error: "Failed to fetch departures",
          details: error.message,
          ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
        },
        {
          status: error.status,
          ...(error.retryAfter
            ? { headers: { "Retry-After": error.retryAfter } }
            : {}),
        }
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Failed to fetch departures", details: "Unexpected upstream response shape" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch departures", details: "Unknown error" },
      { status: 500 }
    );
  }
}
