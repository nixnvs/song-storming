import { config } from "dotenv";
config({ path: ".env.local" });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import app from "./_app";

const port = 5177;
const NODE_ENV = process.env.NODE_ENV;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

// Wrap your app with CORS
const root = new Hono();
root.use(
  "*",
  cors({
    origin: [FRONTEND_ORIGIN!],
    credentials: true,
  })
);
root.route("/", app);

if (NODE_ENV === "development")
  serve(
    {
      fetch: root.fetch,
      port,
    },
    () => {
      console.log(`API dev server listening on http://localhost:${port}`);
    }
  );

export default root;
