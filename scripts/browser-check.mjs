import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { startServer } from "./server.mjs";

const executablePath = process.env.FORM_CHROME;
const browser = await chromium.launch(executablePath ? {executablePath} : {channel: "chrome"});
const server = await startServer();
const url = "http://127.0.0.1:" + server.address().port + "/";
const sample = {name: "Sam Rivera", email: "sam@example.com", note: "Emergency Brownie Box, because I forgot Secret Santa again."};

const button = (page, name) => page.getByRole("button", {name, exact: true});
const email = (page) => page.getByLabel("Pickup email");
const note = (page) => page.getByLabel("Which box are you reserving?");
const submit = (page) => button(page, "Reserve my treat box");
const submitted = (page) => page.getByRole("heading", {name: "Treat box reserved"}).waitFor();

async function withDraft(query, run) {
  const context = await browser.newContext(devices["Pixel 7"]);
  try {
    const page = await context.newPage();
    await page.goto(url + query);
    await page.getByLabel("Pickup name").fill(sample.name);
    await button(page, "Continue").click();
    await email(page).fill(sample.email);
    await note(page).fill(sample.note);
    await run(page, context);
  } finally {
    await context.close();
  }
}

try {
  for (const broken of [false, true]) {
    await withDraft(broken ? "?before=back" : "", async (page) => {
      await page.goBack();
      assert.equal(await page.getByLabel("Pickup name").inputValue(), sample.name);
      await button(page, "Continue").click();
      assert.equal(await email(page).inputValue(), broken ? "" : sample.email);
      assert.equal(await note(page).inputValue(), broken ? "" : sample.note);
    });
    await withDraft(broken ? "?before=back" : "", async (page) => {
      await page.getByRole("button", {name: "Back", exact: true}).click();
      await button(page, "Continue").click();
      assert.equal(await email(page).inputValue(), broken ? "" : sample.email);
      assert.equal(await note(page).inputValue(), broken ? "" : sample.note);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
      await page.getByRole("heading", {name: "Kane CLI evidence"}).waitFor();
    });
    await withDraft(broken ? "?before=stale" : "", async (page) => {
      await page.getByRole("button", {name: "Back", exact: true}).click();
      await button(page, "Continue").click();
      assert.equal(await note(page).inputValue(), sample.note);
      await note(page).fill("Secret Santa Cookies");
      assert.equal(await note(page).inputValue(), "Secret Santa Cookies");
      await page.reload();
      assert.equal(await note(page).inputValue(), broken ? sample.note : "Secret Santa Cookies");
    });
    await withDraft(broken ? "?before=offline" : "", async (page) => {
      await button(page, "Start test outage").click();
      await submit(page).click();
      await page.getByText("Couldn’t submit. Reconnect and try again.", {exact: true}).waitFor();
      await page.reload();
      await page.getByText("Test outage on", {exact: true}).waitFor();
      assert.equal(await note(page).inputValue(), broken ? "" : sample.note);
      if (!broken) {
        await button(page, "End test outage").click();
        await submit(page).click();
        await submitted(page);
      }
    });
  }

  await withDraft("", async (page, context) => {
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await submit(page).click();
    await page.getByText("Couldn’t submit. Reconnect and try again.", {exact: true}).waitFor();
    await page.reload();
    await page.getByText("Offline", {exact: true}).waitFor();
    assert.equal(await email(page).inputValue(), sample.email);
    assert.equal(await note(page).inputValue(), sample.note);
    await context.setOffline(false);
    await submit(page).click();
    await submitted(page);
  });

  console.log("Passed: browser Back, visible Back, mobile width, server outage and offline/reload/reconnect. The three regression fixtures reproduced the intended failures, including an older draft after reload.");
} finally {
  await browser.close();
  server.close();
}
