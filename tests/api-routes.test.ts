import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getStops } from "@/app/api/stops/route";
import { GET as getDepartures } from "@/app/api/departures/route";
import { fetchVbb } from "@/lib/vbb";

const FAST = { attemptTimeoutMs: 50, maxRetries: 1, backoffMs: 1 };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/stops", () => {
  it("transforms upstream locations into stops (nested coordinates)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            type: "stop",
            id: "900058101",
            name: "S Südkreuz",
            location: { latitude: 52.475, longitude: 13.365 },
          },
          { type: "location", id: "x", name: "not a stop" },
        ])
      )
    );

    const res = await getStops(
      new Request("http://localhost/api/stops?query=suedkreuz")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        id: "900058101",
        name: "S Südkreuz",
        location: { latitude: 52.475, longitude: 13.365 },
      },
    ]);
  });

  it("400s without a query parameter", async () => {
    const res = await getStops(new Request("http://localhost/api/stops"));
    expect(res.status).toBe(400);
  });

  it("502s when the upstream keeps failing (after retry)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("oops", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await getStops(
      new Request("http://localhost/api/stops?query=x")
    );
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("passes 429 through with retryAfter and does NOT retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("slow down", {
        status: 429,
        headers: { "Retry-After": "30" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await getStops(
      new Request("http://localhost/api/stops?query=x")
    );
    expect(res.status).toBe(429);
    expect((await res.json()).retryAfter).toBe("30");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("502s on malformed upstream JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 200 }))
    );
    const res = await getStops(
      new Request("http://localhost/api/stops?query=x")
    );
    expect(res.status).toBe(502);
  });
});

describe("GET /api/departures", () => {
  it("transforms the v6 {departures: []} envelope and tolerates nulls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          departures: [
            {
              line: { name: "U7", product: "subway" },
              direction: "Rudow",
              when: "2026-06-12T18:00:00+02:00",
              platform: null,
            },
            { line: null, direction: null, when: null, platform: null },
          ],
          realtimeDataUpdatedAt: 1781280000,
        })
      )
    );

    const res = await getDepartures(
      new Request("http://localhost/api/departures?stopId=900058101")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      {
        line: "U7",
        direction: "Rudow",
        when: "2026-06-12T18:00:00+02:00",
        platform: "N/A",
        type: "subway",
      },
      {
        line: "N/A",
        direction: "Unknown",
        when: null,
        platform: "N/A",
        type: "Unknown",
      },
    ]);
  });

  it("400s without a stopId", async () => {
    const res = await getDepartures(
      new Request("http://localhost/api/departures")
    );
    expect(res.status).toBe(400);
  });

  it("maps an upstream 404 (unknown stop) to a 4xx, not 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("no such stop", { status: 404 }))
    );
    const res = await getDepartures(
      new Request("http://localhost/api/departures?stopId=nope")
    );
    expect(res.status).toBe(404);
  });

  it("502s on an unexpected response shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ totally: "wrong" }))
    );
    const res = await getDepartures(
      new Request("http://localhost/api/departures?stopId=900058101")
    );
    expect(res.status).toBe(502);
  });
});

describe("fetchVbb retry/timeout behavior", () => {
  it("504s after timeouts on every attempt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init.signal as AbortSignal;
            signal.addEventListener("abort", () => reject(signal.reason));
          })
      )
    );

    await expect(fetchVbb("/locations?query=x", FAST)).rejects.toMatchObject({
      name: "VbbError",
      status: 504,
    });
  });

  it("recovers when the retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVbb("/locations?query=x", FAST)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("502s on network failure after exhausting retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed"))
    );
    await expect(fetchVbb("/locations?query=x", FAST)).rejects.toMatchObject({
      status: 502,
    });
  });
});
