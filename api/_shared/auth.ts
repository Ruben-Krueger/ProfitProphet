import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "./supabase.js";

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    email?: string;
  };
}

export const withAuth = (
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<any>
) => {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Get the authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Missing or invalid authorization header",
        });
      }

      // Extract the JWT token
      const token = authHeader.substring(7);

      // Verify the token with Supabase
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          error: "Invalid or expired token",
        });
      }

      // Add user to request object
      req.user = {
        id: user.id,
        email: user.email,
      };

      // Call the original handler
      return handler(req, res);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({
        error: "Authentication failed",
      });
    }
  };
};
