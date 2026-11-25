import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { startTicketServer } from "./ticket-server.mjs";

const server = await startTicketServer();
const root = `http://127.0.0.1:${server.address().port}/`;
let browser;

async function check(scenario, inspect) {
  const page = await browser.newPage(devices["Pixel 7"]);
  try {
    await page.goto(root + "?case=" + scenario);
    await inspect(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
  } finally {
    await page.close();
  }
}

const button = (page, name) => page.getByRole("button", {name, exact: true});
const metric = (page, label) => page.locator(".metric").filter({has: page.getByText(label, {exact: true})}).locator("dd");

try {
  const executablePath = process.env.FORM_CHROME;
  browser = await chromium.launch(executablePath ? {executablePath} : {channel: "chrome"});
  await check("retry", async (page) => {
    await button(page, "Pay $75").click();
    await page.getByText("Payment confirmation timed out", {exact: true}).waitFor();
    await page.reload();
    await button(page, "Retry payment").click();
    await page.getByText("Ticket confirmed", {exact: true}).waitFor();
    await button(page, "Payment activity").click();
    assert.equal(await metric(page, "Captured charges").innerText(), "1");
    assert.equal(await metric(page, "Total captured").innerText(), "$75.00");
  });
  await check("refund", async (page) => {
    await button(page, "Cancel show and refund ticket").click();
    await page.getByText("Refunded", {exact: true}).waitFor();
    await button(page, "Payment activity").click();
    assert.equal(await metric(page, "Buyer refund").innerText(), "$75.00");
    assert.equal(await metric(page, "Organizer funds recovered").innerText(), "$75.00");
    assert.equal(await metric(page, "Platform refund cost").innerText(), "$0.00");
  });
  console.log("Chrome verified ticket retry after reload and refund reconciliation at a mobile viewport.");
} finally {
  await browser?.close();
  server.close();
}
