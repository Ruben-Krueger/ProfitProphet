import type { VercelRequest, VercelResponse } from "@vercel/node";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const handleCors = (req: VercelRequest, res: VercelResponse) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true; // Indicates that the request was handled
  }

  return false; // Indicates that the request should continue to the handler
};

export const withCors = (
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Handle CORS
    const handled = handleCors(req, res);
    if (handled) {
      return;
    }

    // Call the original handler
    return handler(req, res);
  };
};
