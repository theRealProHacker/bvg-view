import { NextResponse } from "next/server";

const HAFAS_API = "https://v5.vbb.transport.rest/locations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${HAFAS_API}?query=${encodeURIComponent(query)}&results=5&fuzzy=true&stops=true`,
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
    
    // Filter for only stops and transform the response
    const stops = data
      .filter((location: any) => location.type === 'stop')
      .map((stop: any) => ({
        id: stop.id,
        name: stop.name,
        location: {
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
      }));

    return NextResponse.json(stops);
  } catch (error) {
    console.error("Error fetching stops:", error);
    return NextResponse.json(
      { error: "Failed to fetch stops", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}