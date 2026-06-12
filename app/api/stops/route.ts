import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { fetchVbb, parseStops, VbbError } from "@/lib/vbb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
  }

  try {
    const data = await fetchVbb(
      `/locations?query=${encodeURIComponent(query)}&results=5&fuzzy=true&stops=true`
    );
    return NextResponse.json(parseStops(data));
  } catch (error) {
    console.error("Error fetching stops:", error);
    if (error instanceof VbbError) {
      return NextResponse.json(
        {
          error: "Failed to fetch stops",
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
        { error: "Failed to fetch stops", details: "Unexpected upstream response shape" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch stops", details: "Unknown error" },
      { status: 500 }
    );
  }
}
