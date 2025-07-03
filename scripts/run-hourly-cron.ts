import handler from "../api/cron/hourly";

// Mock request and response objects
const mockRequest = {
  headers: {
    authorization: `Bearer ${process.env.CRON_SECRET || "local-dev-secret"}`,
  },
} as any;

const mockResponse = {
  status: (code: number) => ({
    json: (data: any) => {
      console.log(`📊 Status: ${code}`);
      console.log("📈 Response:", JSON.stringify(data, null, 2));
      return mockResponse;
    },
  }),
  json: (data: any) => {
    console.log("📈 Response:", JSON.stringify(data, null, 2));
    return mockResponse;
  },
} as any;

async function runHourlyCron() {
  console.log("🚀 Starting hourly cron job...");

  try {
    // Execute the handler
    await handler(mockRequest, mockResponse);
    console.log("✅ Hourly cron job completed successfully!");
  } catch (error) {
    console.error("💥 Error running hourly cron job:", error);
    process.exit(1);
  }
}

// Run the cron job
runHourlyCron();
