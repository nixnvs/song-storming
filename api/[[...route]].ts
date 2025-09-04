// api/[[...route]].ts
import app from "./_app";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Wrap Hono app to work with Vercel’s Node runtime
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Rebuild URL because Vercel passes route as a query param
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  if (req.query?.route) {
    const routePath = Array.isArray(req.query.route)
      ? req.query.route.join("/")
      : req.query.route;
    url.pathname = `/api/${routePath || ""}`;
  }

  const honoReq = new Request(url.toString(), {
    method: req.method,
    headers: req.headers as any,
    body:
      req.method !== "GET" && req.method !== "HEAD" ? (req as any) : undefined,
  });

  const honoRes = await app.fetch(honoReq);

  // Pipe response back to Vercel’s res
  res.status(honoRes.status);
  honoRes.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = Buffer.from(await honoRes.arrayBuffer());
  res.send(buf);
}
