const query = new URLSearchParams(location.search);
const scenario = query.get("case") === "refund" ? "refund" : "retry";
const build = query.get("build");
const isRefund = scenario === "refund";
const byId = (id) => document.getElementById(id);
const action = byId("action");
const activity = byId("activity");
const reset = byId("reset");
const buildControl = byId("build");
const storageKey = "ticket-check:" + scenario + ":" + (build ?? "default");
const dollars = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"});
let order;
let phase;

const money = (cents) => dollars.format(cents / 100);
const names = {capture: "Payment captured", transfer: "Funds transferred to organizer", refund: "Buyer refund issued", transfer_reversal: "Organizer transfer reversed"};

byId(scenario + "-link").setAttribute("aria-current", "page");
byId("view-label").textContent = isRefund ? "Organizer console" : "Fan checkout";
byId("scenario-title").textContent = isRefund ? "Cancel the show" : "Buy a ticket";
byId("scenario-note").textContent = isRefund
  ? "The buyer has paid and the organizer has received the proceeds. Cancelling should refund the buyer and reverse the transfer."
  : "The first payment goes through, but checkout loses the confirmation. Retry to see what lands in the ledger.";

async function request(operation, params) {
  const response = await fetch("/api/tickets/" + operation + "?" + new URLSearchParams(params), {
    method: "POST", headers: {"X-Ticket-Sandbox": "demo"},
  });
  if (response.status === 504 && operation === "pay") return null;
  if (!response.ok) throw new Error("The sandbox could not complete that action. Start over or try again.");
  return response.json();
}

function paint() {
  const status = byId("status");
  const complete = phase === "complete";
  const timeout = phase === "timeout";
  const activeBuild = order.intentionalFixture ? "before" : "after";
  buildControl.value = activeBuild;
  buildControl.disabled = false;
  byId("fixture-note").hidden = activeBuild !== "before";
  byId("retry-link").href = "/?case=retry&build=" + activeBuild;
  byId("refund-link").href = "/?case=refund&build=" + activeBuild;
  action.textContent = isRefund ? "Cancel show and refund ticket" : timeout ? "Retry payment" : "Pay $75";
  action.disabled = !order || complete;
  activity.hidden = !complete;
  status.dataset.tone = complete ? "success" : timeout ? "warning" : "neutral";
  status.textContent = complete ? (isRefund ? "Refunded" : "Ticket confirmed")
    : timeout ? "Payment confirmation timed out" : isRefund ? "Buyer status: Paid" : "";
}

function remember() {
  sessionStorage.setItem(storageKey, JSON.stringify({id: order.id, phase}));
}

async function newOrder() {
  action.disabled = true;
  reset.disabled = true;
  order = undefined;
  phase = undefined;
  activity.hidden = true;
  byId("ledger-data").hidden = true;
  byId("ledger-hint").hidden = false;
  byId("status").textContent = "Preparing a sample order…";
  try {
    order = await request("new", build ? {case: scenario, build} : {case: scenario});
    remember();
    paint();
  } catch (error) {
    byId("status").textContent = error.message;
  } finally {
    reset.disabled = false;
  }
}

action.addEventListener("click", async () => {
  action.disabled = true;
  reset.disabled = true;
  try {
    const result = await request(isRefund ? "refund" : "pay", {id: order.id});
    phase = result ? "complete" : "timeout";
    remember();
    paint();
  } catch (error) {
    byId("status").textContent = error.message;
    action.disabled = false;
  } finally {
    reset.disabled = false;
  }
});

activity.addEventListener("click", async () => {
  activity.disabled = true;
  reset.disabled = true;
  try {
    const data = await request("activity", {id: order.id, visible: "yes"});
    byId("order-id").textContent = "Order " + data.id.slice(0, 8).toUpperCase();
    const metrics = isRefund
      ? [["Buyer refund", money(data.buyerRefund), data.buyerRefund !== 7500],
        ["Organizer funds recovered", money(data.organizerFundsRecovered), data.organizerFundsRecovered !== 7500],
        ["Platform refund cost", money(data.platformRefundCost), data.platformRefundCost !== 0]]
      : [["Captured charges", data.capturedCharges, data.capturedCharges !== 1],
        ["Total captured", money(data.totalCaptured), data.totalCaptured !== 7500]];
    byId("metrics").replaceChildren(...metrics.map(([label, value, mismatch]) => {
      const row = document.createElement("div");
      row.className = "metric";
      if (mismatch) row.dataset.mismatch = "";
      const term = document.createElement("dt");
      const definition = document.createElement("dd");
      term.textContent = label;
      definition.textContent = value;
      row.append(term, definition);
      return row;
    }));
    byId("entries").replaceChildren(...data.entries.map(({type, cents}) => {
      const entry = document.createElement("li");
      entry.textContent = names[type] + " · " + money(cents);
      return entry;
    }));
    byId("ledger-hint").hidden = true;
    byId("ledger-data").hidden = false;
    byId("ledger-title").focus();
  } catch (error) {
    byId("status").textContent = error.message;
  } finally {
    activity.disabled = false;
    reset.disabled = false;
  }
});

async function refreshReports() {
  const status = byId("evidence-status");
  try {
    const response = await fetch("/api/ticket-runs");
    if (!response.ok) throw new Error("Reports unavailable");
    const {runs} = await response.json();
    const verified = runs.filter((run) => run.verdict === "passed" || run.verdict === "failed");
    const incomplete = runs.filter((run) => run.verdict !== "passed" && run.verdict !== "failed");
    status.textContent = verified.length ? "Recorded browser runs and ledger observations" : "No complete Kane runs yet.";
    const render = (run) => {
      const details = document.createElement("details");
      const heading = document.createElement("summary");
      heading.textContent = run.label.replace(/^ticket /, "").replace(/^retry/, "Payment retry")
        .replace(/^refund/, "Show cancellation").replace(/ before$/, " · Original").replace(/ after$/, " · Repaired");
      const verdict = document.createElement("span");
      verdict.className = "verdict";
      verdict.dataset.result = run.verdict ?? "none";
      verdict.textContent = run.verdict ?? "no verdict";
      heading.append(verdict);
      details.append(heading);
      if (run.verification) {
        const method = document.createElement("p");
        method.textContent = "Kane browser run: " + (run.kaneVerdict ?? "no verdict") + ". " + run.verification + ".";
        details.append(method);
      }
      if (run.check?.observed) {
        const list = document.createElement("ul");
        for (const [label, expected] of Object.entries(run.check.expected)) {
          const line = document.createElement("li");
          line.textContent = label + " · expected " + expected + " · observed " + run.check.observed[label];
          list.append(line);
        }
        details.append(list);
      }
      for (const step of run.steps ?? []) {
        const line = document.createElement("p");
        line.textContent = step.status + " · " + step.remark;
        details.append(line);
      }
      if (run.summary || run.reason) {
        const line = document.createElement("p");
        line.textContent = run.summary ?? run.reason;
        details.append(line);
      }
      return details;
    };
    const reports = byId("reports");
    reports.replaceChildren(...verified.map(render));
    if (incomplete.length) {
      const diagnostics = document.createElement("details");
      const heading = document.createElement("summary");
      heading.textContent = "Incomplete attempts (" + incomplete.length + ")";
      diagnostics.append(heading, ...incomplete.map(render));
      reports.append(diagnostics);
    }
  } catch {
    status.textContent = "Could not load local Kane reports.";
  }
}

async function restoreOrder() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved) {
      order = await request("activity", {id: saved.id});
      phase = saved.phase;
      paint();
      return;
    }
  } catch {
    sessionStorage.removeItem(storageKey);
  }
  await newOrder();
}

reset.addEventListener("click", newOrder);
buildControl.addEventListener("change", () => {
  location.search = new URLSearchParams({case: scenario, build: buildControl.value});
});
byId("refresh").addEventListener("click", refreshReports);
void restoreOrder();
void refreshReports();
