import http from "node:http";
import next from "next";
import { createStudio } from "./server.js";
import { createSiteHandler } from "./site-handler.js";

const port = Number(process.env.PORT || 8770);
const dev = process.argv.includes("--dev");
const app = next({ dev, hostname: "127.0.0.1", port });
await app.prepare();
const studio = await createStudio();
const handler = createSiteHandler({
  studio,
  nextHandler: app.getRequestHandler(),
});
const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end("The page could not be loaded. Please try again.");
  });
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Walkthrough Studio: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    app.close().finally(() => process.exit(0));
  });
