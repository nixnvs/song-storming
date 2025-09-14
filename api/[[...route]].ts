// api/[[...route]].ts
import app from "./_app";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Wrap Hono app to work with Vercel’s Node runtime
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Rebuild URL because Vercel passes route as a query param
    const url = new URL(req.url || "", `http://${req.headers.host}`);

    if (req.query?.route) {
      const routePath = Array.isArray(req.query.route)
        ? req.query.route.join("/")
        : req.query.route;
      url.pathname = `/${routePath || ""}`; // ✅ don’t prefix with /api again
    }

    // Convert Vercel req → Fetch API Request
    const honoReq: Request & { duplex?: string } = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(req.headers as any), // safer conversion
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? (req as any) // Vercel req is already a stream
          : undefined,
      duplex: "half",
    } as Request & { duplex?: string });

    // Pass to Hono
    const honoRes = await app.fetch(honoReq);

    // Pipe response back to Vercel’s res
    res.status(honoRes.status);

    honoRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (honoRes.body) {
      const buf = Buffer.from(await honoRes.arrayBuffer());
      res.end(buf);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Hono handler error:", err);
    res.status(500).send("Internal Server Error");
  }
}
