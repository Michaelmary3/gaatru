import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createTicketLedger, pay, refund, snapshot } from "./ticket-ledger.mjs";
import { recentKaneRuns } from "./kane-reports.mjs";

const assets = new Map([
  ["/", ["tickets.html", "text/html"]],
  ["/tickets.css", ["tickets.css", "text/css"]],
  ["/tickets.js", ["tickets.js", "text/javascript"]],
]);

function json(res, status, data) {
  res.writeHead(status, {"Content-Type": "application/json", "Cache-Control": "no-store"})
    .end(JSON.stringify(data));
}

export async function startTicketServer({port = 0, onActivity = () => {}, demonstrateRegressions = false} = {}) {
  const ledger = createTicketLedger({demonstrateRegressions});
  const server = createServer(async (req, res) => {
    const {pathname, searchParams} = new URL(req.url, "http://localhost");
    try {
      if (req.method === "GET" && pathname === "/api/ticket-runs") {
        const runs = await recentKaneRuns({tickets: true});
        return json(res, 200, {runs});
      }
      if (req.method === "POST" && pathname.startsWith("/api/tickets/")) {
        if (req.headers["x-ticket-sandbox"] !== "demo") return json(res, 403, {error: "Sandbox request required"});
        const scenario = searchParams.get("case");
        if (pathname === "/api/tickets/new" && ["retry", "refund"].includes(scenario)) {
          const build = searchParams.get("build");
          if (build && !["before", "after"].includes(build)) return json(res, 400, {error: "Unknown build"});
          return json(res, 201, snapshot(ledger.create(scenario, build)));
        }
        const order = ledger.get(searchParams.get("id"));
        if (!order) return json(res, 404, {error: "Order unavailable"});
        if (pathname === "/api/tickets/pay" && order.scenario === "retry") {
          const status = pay(order);
          return json(res, status, status === 504 ? {error: "Confirmation timed out"} : snapshot(order));
        }
        if (pathname === "/api/tickets/refund" && order.scenario === "refund") {
          refund(order);
          return json(res, 200, snapshot(order));
        }
        if (pathname === "/api/tickets/activity") {
          const data = snapshot(order);
          if (searchParams.get("visible") === "yes") onActivity(data);
          return json(res, 200, data);
        }
      }
      const asset = req.method === "GET" && assets.get(pathname);
      if (!asset) return res.writeHead(404).end();
      const [file, mime] = asset;
      const content = await readFile(new URL("../public/" + file, import.meta.url));
      res.writeHead(200, {"Content-Type": mime + "; charset=utf-8", "Cache-Control": "no-store"}).end(content);
    } catch {
      json(res, 500, {error: "Sandbox request failed"});
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const requestedPort = Number(args.find((arg) => !arg.startsWith("--")) ?? "4174");
  const server = await startTicketServer({port: requestedPort, demonstrateRegressions: args.includes("--fixture")});
  console.log("Ticket Check is listening on http://127.0.0.1:" + server.address().port);
}
