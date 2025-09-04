// index.ts
import { serve } from "@hono/node-server";
import app from "./_app";
import { config } from "dotenv";

config({
  path: ".env.local",
});

const port = process.env.PORT ? Number(process.env.PORT) : 5177;

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(`API dev server listening on http://localhost:${port}`);
  }
);
