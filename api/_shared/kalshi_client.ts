// src/clients/kalshi.ts
// TODO: check if Kalshi has a package
import { Market, Config } from "./types";
import * as crypto from "crypto";

interface KalshiMarketResponse {
  markets: Array<{
    ticker: string;
    title: string;
    subtitle?: string;
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    volume: number;
    open_interest: number;
    close_ts: number;
    event_ticker: string;
    status: string;
    category: string;
  }>;
  cursor?: string;
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

  private async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
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

    return response.json();
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

      const data: KalshiMarketResponse = await this.makeAuthenticatedRequest(
        `/markets?${params.toString()}`
      );

      const parsedMarkets = data.markets.map(this.parseMarketData);
      markets.push(...parsedMarkets);

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

    const data: KalshiMarketResponse = await this.makeAuthenticatedRequest(
      `/markets?${params.toString()}`
    );

    return data.markets.map(this.parseMarketData);
  }

  async fetchMarketDetails(marketId: string): Promise<Market> {
    const data = await this.makeAuthenticatedRequest(`/markets/${marketId}`);
    return this.parseMarketData(data.market);
  }

  // Public method for testing authentication
  async testAuthentication(): Promise<any> {
    return await this.makeAuthenticatedRequest("/user");
  }

  private parseMarketData = (marketData: any): Market => {
    // Calculate mid prices for yes/no (display only — not what you'd actually pay to fill)
    const yesPrice = (marketData.yes_bid + marketData.yes_ask) / 2 / 100; // Convert cents to dollars
    const noPrice = (marketData.no_bid + marketData.no_ask) / 2 / 100;

    // Real executable prices, for strategies that need the price an order would actually fill at
    const yesBid = marketData.yes_bid / 100;
    const yesAsk = marketData.yes_ask / 100;
    const noBid = marketData.no_bid / 100;
    const noAsk = marketData.no_ask / 100;

    // Fallback to epoch time (Jan 1, 1970)
    let resolutionDate = new Date(0);
    if (
      marketData.close_ts &&
      typeof marketData.close_ts === "number" &&
      marketData.close_ts > 0
    ) {
      resolutionDate = new Date(marketData.close_ts * 1000);
      // Validate the parsed date
      if (isNaN(resolutionDate.getTime())) {
        resolutionDate = new Date(0); // Fallback to epoch time (Jan 1, 1970)
      }
    } else {
      resolutionDate = new Date(0); // Fallback to epoch time (Jan 1, 1970)
    }

    return {
      id: marketData.ticker,
      title: marketData.title,
      question: `${marketData.title}${marketData.subtitle ? ` - ${marketData.subtitle}` : ""}`,
      yesPrice,
      noPrice,
      yesBid,
      yesAsk,
      noBid,
      noAsk,
      volume: marketData.volume,
      openInterest: marketData.open_interest,
      resolutionDate,
      category: marketData.category,
      subtitle: marketData.subtitle,
      eventId: marketData.event_ticker,
      status: marketData.status as "active" | "closed" | "settled",
      lastUpdated: new Date(),
    };
  };

  // TODO: replace with rate-limiter package like 'bottleneck'
  // Rate limiting helper
  private requestQueue: Array<() => Promise<any>> = [];
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
