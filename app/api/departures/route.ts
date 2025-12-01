import { NextResponse } from "next/server";

const HAFAS_API = "https://v6.vbb.transport.rest/stops";

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
    const response = await fetch(
      `${HAFAS_API}/${stopId}/departures?duration=30&results=10`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BerlinTransport/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return NextResponse.json([]);
    }
    
    // Transform the response to match our interface
    const departures = data.map((departure: any) => ({
      line: departure.line?.name || "N/A",
      direction: departure.direction || "Unknown",
      when: departure.when || null,
      platform: departure.platform || "N/A",
      type: departure.line?.product || "Unknown",
    }));

    return NextResponse.json(departures);
  } catch (error) {
    console.error("Error fetching departures:", error);
    return NextResponse.json(
      { error: "Failed to fetch departures", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}