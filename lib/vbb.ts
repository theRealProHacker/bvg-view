import { z } from "zod";

const BASE_URL = "https://v6.vbb.transport.rest";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "BerlinTransport/1.0",
};

// Budget: Netlify functions are killed at ~10s, so the whole call
// (attempts + backoff) must stay well under that.
const ATTEMPT_TIMEOUT_MS = 4_000;
const MAX_RETRIES = 1;
const BACKOFF_MS = 500;

// Lenient schemas: only the fields we read, everything nullable where the
// HAFAS API may omit it (cancelled departures have when: null), unknown
// extra fields ignored.
const locationSchema = z.object({
  type: z.string().optional(),
  id: z.string(),
  name: z.string(),
  location: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
});

const locationsResponseSchema = z.array(z.unknown());

const departureSchema = z.object({
  line: z
    .object({
      name: z.string().nullish(),
      product: z.string().nullish(),
    })
    .nullish(),
  direction: z.string().nullish(),
  when: z.string().nullish(),
  platform: z.string().nullish(),
});

const departuresResponseSchema = z.object({
  departures: z.array(z.unknown()),
});

export class VbbError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: string | null
  ) {
    super(message);
    this.name = "VbbError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch from the VBB REST API with a per-attempt timeout and bounded retry.
 * Retries only on network errors, timeouts, and 5xx — never on 4xx
 * (a rate-limited public API must not be hammered).
 */
export async function fetchVbb(
  path: string,
  {
    attemptTimeoutMs = ATTEMPT_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
    backoffMs = BACKOFF_MS,
  }: { attemptTimeoutMs?: number; maxRetries?: number; backoffMs?: number } = {}
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * attempt);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(attemptTimeoutMs),
        cache: "no-store",
      });

      if (response.status === 429) {
        void response.body?.cancel();
        throw new VbbError(
          "Upstream rate limit",
          429,
          response.headers.get("Retry-After")
        );
      }
      if (response.status >= 400 && response.status < 500) {
        void response.body?.cancel();
        throw new VbbError(`Upstream rejected request`, response.status);
      }
      if (!response.ok) {
        // 5xx — retryable
        void response.body?.cancel();
        lastError = new VbbError(`Upstream error ${response.status}`, 502);
        continue;
      }

      try {
        return await response.json();
      } catch {
        lastError = new VbbError("Upstream returned invalid JSON", 502);
        continue;
      }
    } catch (error) {
      if (error instanceof VbbError) {
        if (error.status === 429 || error.status < 500) throw error;
        lastError = error;
        continue;
      }
      // AbortSignal.timeout -> TimeoutError; network failures -> TypeError.
      // Both are retryable.
      lastError = error;
    }
  }

  if (lastError instanceof VbbError) throw lastError;
  const timedOut =
    lastError instanceof DOMException && lastError.name === "TimeoutError";
  throw new VbbError(
    timedOut ? "Upstream timed out" : "Upstream unreachable",
    timedOut ? 504 : 502
  );
}

export interface StopResult {
  id: string;
  name: string;
  location: { latitude: number | null; longitude: number | null };
}

export function parseStops(data: unknown): StopResult[] {
  const items = locationsResponseSchema.parse(data);
  const stops: StopResult[] = [];
  for (const item of items) {
    const parsed = locationSchema.safeParse(item);
    if (!parsed.success || parsed.data.type !== "stop") continue;
    stops.push({
      id: parsed.data.id,
      name: parsed.data.name,
      location: {
        latitude: parsed.data.location?.latitude ?? null,
        longitude: parsed.data.location?.longitude ?? null,
      },
    });
  }
  return stops;
}

export interface DepartureResult {
  line: string;
  direction: string;
  when: string | null;
  platform: string;
  type: string;
}

export function parseDepartures(data: unknown): DepartureResult[] {
  // v6 returns { departures: [...] }; tolerate a bare array (older shape).
  const items = Array.isArray(data)
    ? data
    : departuresResponseSchema.parse(data).departures;
  const departures: DepartureResult[] = [];
  for (const item of items) {
    const parsed = departureSchema.safeParse(item);
    if (!parsed.success) continue;
    departures.push({
      line: parsed.data.line?.name ?? "N/A",
      direction: parsed.data.direction ?? "Unknown",
      when: parsed.data.when ?? null,
      platform: parsed.data.platform ?? "N/A",
      type: parsed.data.line?.product ?? "Unknown",
    });
  }
  return departures;
}
