import { randomUUID } from "node:crypto";

const price = 7500;

export function createTicketLedger({demonstrateRegressions = false} = {}) {
  const orders = new Map();

  function create(scenario, build) {
    const order = {id: randomUUID(), scenario, entries: [], timedOut: false,
      demonstrateRegressions: build ? build === "before" : demonstrateRegressions};
    if (scenario === "refund") {
      post(order, "capture");
      post(order, "transfer");
    }
    orders.set(order.id, order);
    return order;
  }

  return {create, get: (id) => orders.get(id)};
}

function post(order, type) {
  order.entries.push({type, cents: price});
}

export function pay(order) {
  const alreadyCaptured = order.entries.some(({type}) => type === "capture");
  if (!alreadyCaptured || order.demonstrateRegressions) post(order, "capture");
  if (!order.timedOut) {
    order.timedOut = true;
    return 504;
  }
  return 200;
}

export function refund(order) {
  const hasEntry = (kind) => order.entries.some(({type}) => type === kind);
  if (!hasEntry("refund")) post(order, "refund");
  if (!order.demonstrateRegressions && hasEntry("transfer") && !hasEntry("transfer_reversal")) {
    post(order, "transfer_reversal");
  }
}

export function snapshot(order) {
  const amounts = (kind) => order.entries.filter(({type}) => type === kind).map(({cents}) => cents);
  const sum = (kind) => amounts(kind).reduce((total, cents) => total + cents, 0);
  const buyerRefund = sum("refund");
  const organizerFundsRecovered = sum("transfer_reversal");
  return {
    id: order.id,
    intentionalFixture: order.demonstrateRegressions,
    entries: order.entries,
    capturedCharges: amounts("capture").length,
    totalCaptured: sum("capture"),
    buyerRefund,
    organizerFundsRecovered,
    platformRefundCost: buyerRefund - organizerFundsRecovered,
  };
}
