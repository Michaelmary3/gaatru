import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { projectRoot, recentKaneRuns } from "./kane-reports.mjs";

const publicFiles = new Map([
  ["/", ["index.html", "text/html"]],
  ["/site.css", ["site.css", "text/css"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/offline.js", ["offline.js", "text/javascript"]],
]);

export async function startServer({ port = 0, host = "127.0.0.1" } = {}) {
  const submissions = new Set();
  let kaneState = "idle";
  const server = createServer(async (req, res) => {
    const route = new URL(req.url, "http://localhost").pathname;
    const localRequest = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
    if (req.method === "GET" && route === "/api/kane-runs") {
      if (!localRequest) {
        res.writeHead(403).end();
        return;
      }
      try {
        const runs = await recentKaneRuns();
        res.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"})
          .end(JSON.stringify({state: kaneState, runs}));
      } catch {
        res.writeHead(500).end();
      }
      return;
    }
    if (req.method === "POST" && ["/api/kane-back", "/api/kane-stale"].includes(route)) {
      const localOrigins = ["http://127.0.0.1:" + req.socket.localPort, "http://localhost:" + req.socket.localPort];
      if (!localRequest || !localOrigins.includes(req.headers.origin) || req.headers["x-form-survival"] !== "run") {
        res.writeHead(403).end();
        return;
      }
      if (kaneState === "running") {
        res.writeHead(409).end();
        return;
      }
      kaneState = "running";
      const child = spawn(process.execPath, [fileURLToPath(new URL("scripts/verify.mjs", projectRoot)), "compare", route.endsWith("stale") ? "stale" : "back", "--headed"],
        {cwd: fileURLToPath(projectRoot), stdio: "ignore"});
      child.once("error", () => { kaneState = "stopped"; });
      child.once("close", (code) => { kaneState = code === 0 ? "completed" : "stopped"; });
      res.writeHead(202).end();
      return;
    }
    if (req.method === "POST" && route === "/api/submit") {
      if (req.headers["x-test-outage"] === "yes") {
        res.writeHead(503).end("Demo outage");
        return;
      }
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) {
            res.writeHead(413).end();
            return;
          }
        }
        const data = JSON.parse(body);
        if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/i.test(data.id) ||
            typeof data.name !== "string" || !data.name.trim() ||
            typeof data.email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(data.email) ||
            typeof data.note !== "string" || !data.note.trim()) {
          res.writeHead(422).end("Incomplete reservation");
          return;
        }
        const status = submissions.has(data.id) ? 200 : 201;
        submissions.add(data.id);
        res.writeHead(status).end();
      } catch {
        res.writeHead(400).end("Invalid reservation");
      }
      return;
    }

    const entry = publicFiles.get(route);
    if (req.method !== "GET" || !entry) {
      res.writeHead(404).end();
      return;
    }
    try {
      const [filename, type] = entry;
      const bytes = await readFile(new URL("../public/" + filename, import.meta.url));
      res.writeHead(200, {"Content-Type": type + "; charset=utf-8", "Cache-Control": "no-cache"}).end(bytes);
    } catch {
      res.writeHead(500).end("Could not load the demo file");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
  const server = await startServer({port: 4173, host});
  console.log("Form Survival is listening on http://" + host + ":" + server.address().port);
}
