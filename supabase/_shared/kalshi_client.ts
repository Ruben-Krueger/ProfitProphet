// src/clients/kalshi.ts

import { Market, Config } from './types';

interface KalshiAuthResponse {
  token: string;
  expiry: string;
}

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

export class KalshiClient {
  private baseUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: Config['kalshi']) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  private async authenticate(): Promise<void> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return; // Token still valid
    }

    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: process.env.KALSHI_EMAIL,
          password: process.env.KALSHI_PASSWORD,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data: KalshiAuthResponse = await response.json();
      this.token = data.token;
      // Tokens expire in 30 minutes, set expiry to 25 minutes for safety
      this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000);
    } catch (error) {
      throw new Error(`Failed to authenticate with Kalshi: ${error}`);
    }
  }

  private async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    await this.authenticate();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired, re-authenticate and retry
      this.token = null;
      await this.authenticate();
      return this.makeAuthenticatedRequest(endpoint, options);
    }

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async fetchAllMarkets(): Promise<Market[]> {
    const markets: Market[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        limit: '100',
        status: 'open',
        ...(cursor && { cursor }),
      });

      const data: KalshiMarketResponse = await this.makeAuthenticatedRequest(
        `/markets?${params.toString()}`
      );

      const parsedMarkets = data.markets.map(this.parseMarketData);
      markets.push(...parsedMarkets);
      
      cursor = data.cursor;
    } while (cursor);

    return markets;
  }

  async fetchMarketsByCategory(category: string): Promise<Market[]> {
    const params = new URLSearchParams({
      limit: '100',
      status: 'open',
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

  private parseMarketData = (marketData: any): Market => {
    // Calculate mid prices for yes/no
    const yesPrice = (marketData.yes_bid + marketData.yes_ask) / 2 / 100; // Convert cents to dollars
    const noPrice = (marketData.no_bid + marketData.no_ask) / 2 / 100;

    return {
      id: marketData.ticker,
      title: marketData.title,
      question: `${marketData.title}${marketData.subtitle ? ` - ${marketData.subtitle}` : ''}`,
      yesPrice,
      noPrice,
      volume: marketData.volume,
      openInterest: marketData.open_interest,
      resolutionDate: new Date(marketData.close_ts * 1000),
      category: marketData.category,
      subtitle: marketData.subtitle,
      eventId: marketData.event_ticker,
      status: marketData.status as 'open' | 'closed' | 'settled',
      lastUpdated: new Date(),
    };
  };

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

export const createKalshiClient = (config: Config['kalshi']): KalshiClient => {
  return new KalshiClient(config);
};