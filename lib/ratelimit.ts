import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 5 bookings par IP par heure
export const bookingLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "rl:booking",
});

// 60 poses de verrou par IP par heure : une cliente en pose quelques-unes en
// changeant d'avis, mais ça empêche de geler un agenda entier en boucle.
export const holdLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 h"),
  prefix: "rl:hold",
});

// 10 tentatives d'inscription par IP par heure
export const signupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "rl:signup",
});

export function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  );
}
