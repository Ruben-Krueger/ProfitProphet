import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../api/cron/hourly";

// Mock request and response objects. Only the parts the handler touches are
// implemented, so each is asserted to the full Vercel type at the call site.
interface MockRequest {
  headers: { authorization: string };
}

interface MockResponse {
  status: (code: number) => { json: (data: unknown) => MockResponse };
  json: (data: unknown) => MockResponse;
}

const mockRequest: MockRequest = {
  headers: {
    authorization: `Bearer ${process.env.CRON_SECRET || "local-dev-secret"}`,
  },
};

const mockResponse: MockResponse = {
  status: (code: number) => ({
    json: (data: unknown) => {
      console.log(`📊 Status: ${code}`);
      console.log("📈 Response:", JSON.stringify(data, null, 2));
      return mockResponse;
    },
  }),
  json: (data: unknown) => {
    console.log("📈 Response:", JSON.stringify(data, null, 2));
    return mockResponse;
  },
};

async function runHourlyCron() {
  console.log("🚀 Starting hourly cron job...");

  try {
    // Execute the handler
    await handler(
      mockRequest as unknown as VercelRequest,
      mockResponse as unknown as VercelResponse
    );
    console.log("✅ Hourly cron job completed successfully!");
  } catch (error) {
    console.error("💥 Error running hourly cron job:", error);
    process.exit(1);
  }
}

// Run the cron job
runHourlyCron();
