// src/clients/kalshi.ts
// TODO: check if Kalshi has a package
import { Market, Config } from "./types";
import * as crypto from "crypto";
import { z } from "zod";

/**
 * Kalshi reports money and quantities as fixed-point decimal *strings*
 * ("0.0250", "1234.00"), never as numbers. Parse them explicitly so a value
 * that isn't numeric fails validation instead of silently becoming NaN.
 */
const DecimalString = z
  .string()
  .refine(value => Number.isFinite(Number(value)), {
    message: "expected a numeric string",
  })
  .transform(Number);

/**
 * The subset of Kalshi's market object this app depends on.
 *
 * Field names track the current API: prices are `*_dollars` strings and
 * quantities are `*_fp` strings. Validating instead of casting means the next
 * rename surfaces as a loud parse error rather than NaN rows in the database.
 */
const KalshiRawMarketSchema = z.object({
  ticker: z.string().min(1),
  title: z.string(),
  yes_sub_title: z.string().optional(),
  yes_bid_dollars: DecimalString,
  yes_ask_dollars: DecimalString,
  no_bid_dollars: DecimalString,
  no_ask_dollars: DecimalString,
  volume_fp: DecimalString,
  open_interest_fp: DecimalString,
  close_time: z.string().datetime(),
  event_ticker: z.string().min(1),
  status: z.enum(["active", "closed", "settled"]),
});

type KalshiRawMarket = z.infer<typeof KalshiRawMarketSchema>;

interface KalshiMarketListResponse {
  markets: unknown[];
  cursor?: string;
}

interface KalshiMarketDetailResponse {
  market: unknown;
}

/**
 * Normalize a PEM private key that may have been mangled by the environment:
 * literal "\n" escapes, stripped newlines, surrounding quotes, or CRLF. The
 * base64 body is re-wrapped at 64 chars so OpenSSL can always decode it.
 */
function normalizePem(input: string): string {
  let pem = input.trim();

  // Strip surrounding quotes some env UIs keep.
  if (
    (pem.startsWith('"') && pem.endsWith('"')) ||
    (pem.startsWith("'") && pem.endsWith("'"))
  ) {
    pem = pem.slice(1, -1);
  }

  // Turn escaped "\n" / "\r" into real newlines, drop CR.
  pem = pem.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r/g, "");

  const match = pem.match(
    /-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END \1-----/
  );
  if (!match) {
    // Not a recognizable PEM envelope; hand it back and let OpenSSL report.
    return pem;
  }

  const label = match[1];
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, ""); // keep base64 only
  const wrapped = body.replace(/.{1,64}/g, "$&\n").trimEnd();

  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
}

export class KalshiClient {
  private static readonly UNKNOWN_CATEGORY = "uncategorized";

  private baseUrl: string;
  private privateKey: string;
  private keyId: string;

  constructor(config: Config["kalshi"]) {
    this.baseUrl = config.baseUrl;
    this.privateKey = config.privateKey;
    this.keyId = config.keyId;
  }

  private signRequest(timestamp: string, method: string, path: string): string {
    // Create the message string to sign: timestamp + method + path
    const message = timestamp + method + path;

    try {
      // Load the private key. Normalize first so it decodes regardless of how
      // newlines survived the environment (escaped "\n", stripped, or spaces).
      const privateKey = crypto.createPrivateKey({
        key: normalizePem(this.privateKey),
        format: "pem",
      });

      // Sign the message using RSA-PSS with SHA256
      const signature = crypto.sign("sha256", Buffer.from(message, "utf-8"), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      });

      // Return base64 encoded signature
      return signature.toString("base64");
    } catch (error) {
      console.error("Error signing request:", error);
      throw new Error(
        `Failed to sign request: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Generate timestamp in milliseconds
    const timestamp = Date.now().toString();
    const method = options.method || "GET";

    // Sign the request
    const signature = this.signRequest(timestamp, method, endpoint);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "KALSHI-ACCESS-KEY": this.keyId,
        "KALSHI-ACCESS-SIGNATURE": signature,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Enhanced error logging
      const errorText = await response.text();
      console.error("Kalshi API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        url: `${this.baseUrl}${endpoint}`,
        responseText: errorText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      throw new Error(
        `Kalshi API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async fetchAllMarkets(limit?: number): Promise<Market[]> {
    const markets: Market[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        limit: "100",
        status: "open",
        ...(cursor && { cursor }),
      });

      const data =
        await this.makeAuthenticatedRequest<KalshiMarketListResponse>(
          `/markets?${params.toString()}`
        );

      markets.push(...this.parseMarketPage(data.markets));

      cursor = data.cursor;

      // If a limit is specified and we've reached it, break out of the loop
      if (limit && markets.length >= limit) {
        break;
      }
    } while (cursor);

    // Return only up to the specified limit
    return limit ? markets.slice(0, limit) : markets;
  }

  async fetchMarketsByCategory(category: string): Promise<Market[]> {
    const params = new URLSearchParams({
      limit: "100",
      status: "open",
      category,
    });

    const data = await this.makeAuthenticatedRequest<KalshiMarketListResponse>(
      `/markets?${params.toString()}`
    );

    return this.parseMarketPage(data.markets);
  }

  async fetchMarketDetails(marketId: string): Promise<Market> {
    const data =
      await this.makeAuthenticatedRequest<KalshiMarketDetailResponse>(
        `/markets/${marketId}`
      );
    const result = this.toMarket(data.market);
    if ("error" in result) {
      // A single-market fetch has nothing to fall back to, so surface it.
      throw new Error(
        `Unexpected Kalshi market shape for ${marketId} — ${result.error}`
      );
    }
    return result.market;
  }

  // Public method for testing authentication
  async testAuthentication(): Promise<unknown> {
    return await this.makeAuthenticatedRequest<unknown>("/user");
  }

  /**
   * Validate one raw market. Returns the reason instead of throwing, so a
   * single malformed market can't sink an entire page.
   */
  private toMarket(raw: unknown): { market: Market } | { error: string } {
    const result = KalshiRawMarketSchema.safeParse(raw);
    if (!result.success) {
      const ticker =
        typeof raw === "object" && raw !== null && "ticker" in raw
          ? String((raw as { ticker: unknown }).ticker)
          : "<no ticker>";
      const reasons = result.error.issues
        .map(issue => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return { error: `${ticker} — ${reasons}` };
    }
    return { market: this.parseMarketData(result.data) };
  }

  /**
   * Validate a page of markets. Individual rejects are tolerated and logged,
   * but a page where nothing validates means the API contract moved under us,
   * which must fail loudly rather than quietly scanning zero markets.
   */
  private parseMarketPage(rawMarkets: unknown[]): Market[] {
    const markets: Market[] = [];
    const errors: string[] = [];

    for (const raw of rawMarkets) {
      const result = this.toMarket(raw);
      if ("market" in result) {
        markets.push(result.market);
      } else {
        errors.push(result.error);
      }
    }

    if (rawMarkets.length > 0 && markets.length === 0) {
      throw new Error(
        `Kalshi returned ${rawMarkets.length} markets and none matched the expected shape — ` +
          `the API response format has likely changed. First error: ${errors[0]}`
      );
    }

    if (errors.length > 0) {
      console.warn(
        `Skipped ${errors.length}/${rawMarkets.length} Kalshi markets that failed validation. First: ${errors[0]}`
      );
    }

    return markets;
  }

  private parseMarketData = (marketData: KalshiRawMarket): Market => {
    // Mid prices, for display only — not what an order would actually fill at.
    const yesPrice =
      (marketData.yes_bid_dollars + marketData.yes_ask_dollars) / 2;
    const noPrice = (marketData.no_bid_dollars + marketData.no_ask_dollars) / 2;

    // Combo markets repeat the title as the subtitle; don't say it twice.
    const subtitle =
      marketData.yes_sub_title && marketData.yes_sub_title !== marketData.title
        ? marketData.yes_sub_title
        : undefined;

    return {
      id: marketData.ticker,
      title: marketData.title,
      question: subtitle
        ? `${marketData.title} - ${subtitle}`
        : marketData.title,
      yesPrice,
      noPrice,
      // Executable prices, for strategies that need a real fill price.
      yesBid: marketData.yes_bid_dollars,
      yesAsk: marketData.yes_ask_dollars,
      noBid: marketData.no_bid_dollars,
      noAsk: marketData.no_ask_dollars,
      // Kalshi reports these as fixed-point decimals; the columns are Int.
      volume: Math.round(marketData.volume_fp),
      openInterest: Math.round(marketData.open_interest_fp),
      resolutionDate: new Date(marketData.close_time),
      // Kalshi moved category off the market and onto the parent event, and
      // the column is non-null, so rows stay uncategorized until an event
      // lookup is wired up.
      category: KalshiClient.UNKNOWN_CATEGORY,
      subtitle,
      eventId: marketData.event_ticker,
      status: marketData.status,
      lastUpdated: new Date(),
    };
  };

  // TODO: replace with rate-limiter package like 'bottleneck'
  // Rate limiting helper
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private readonly REQUEST_DELAY = 100; // ms between requests

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      await request();
      await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
    }

    this.isProcessingQueue = false;
  }

  async fetchWithRateLimit<T>(fetcher: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fetcher();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }
}

export const createKalshiClient = (config: Config["kalshi"]): KalshiClient => {
  return new KalshiClient(config);
};
