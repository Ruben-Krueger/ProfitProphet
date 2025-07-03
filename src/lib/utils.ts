import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  if (typeof error === "object" && error !== null) {
    try {
      return { name: "Error", message: JSON.stringify(error) };
    } catch {
      return { name: "Error", message: "[object with circular reference]" };
    }
  }
  return { name: "Error", message: String(error) };
}

export function getApiBaseUrl(): string {
  // If VITE_API_BASE_URL is set, use it (for production)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // For development, use relative URLs to avoid CORS issues
  return "";
}
