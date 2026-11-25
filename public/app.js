const params = new URLSearchParams(location.search);
const regression = params.get("before");
const beforeLabels = {
  back: "Before · Back loses the draft",
  offline: "Before · Retry loses the draft",
  stale: "Before · Reload restores an old draft",
};
const scope = "form-survival:" + (Object.hasOwn(beforeLabels, regression) ? regression : "fixed");
const draftKey = scope + ":draft";
const outageKey = scope + ":outage";
const receiptKey = scope + ":received";
const previousDraftKey = scope + ":previous-draft";
const introForm = document.querySelector("#intro-form");
const detailForm = document.querySelector("#detail-form");
const name = document.querySelector("#name");
const email = document.querySelector("#email");
const note = document.querySelector("#note");
const feedback = document.querySelector("#feedback");
const submit = detailForm.querySelector('button[type="submit"]');
const networkToggle = document.querySelector("#network-toggle");
const networkLabel = document.querySelector("#network-label");
let outage = sessionStorage.getItem(outageKey) === "yes";

function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey)) ?? {};
  } catch {
    return {};
  }
}

function saveDraft() {
  const previous = readDraft();
  const draft = {
    id: previous.id ?? Array.from(crypto.getRandomValues(new Uint8Array(18)),
      (byte) => byte.toString(16).padStart(2, "0")).join(""),
    name: name.value,
    email: email.value,
    note: note.value,
  };
  sessionStorage.setItem(draftKey, JSON.stringify(draft));
  return draft;
}

function restoreDraft() {
  const draft = readDraft();
  name.value = draft.name ?? "";
  email.value = draft.email ?? "";
  note.value = draft.note ?? "";
}

function showRoute() {
  const route = location.hash.slice(1);
  const previous = document.querySelector("#detail-step").hidden ? "intro" : "details";
  const leavingDetails = route !== "details" && previous === "details" && route !== "complete";
  if (regression === "stale" && leavingDetails && !sessionStorage.getItem(previousDraftKey)) {
    sessionStorage.setItem(previousDraftKey, JSON.stringify(readDraft()));
  }
  if (regression === "back" && leavingDetails) {
    const draft = readDraft();
    delete draft.email;
    delete draft.note;
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }

  const complete = route === "complete" && sessionStorage.getItem(receiptKey) === "yes";
  const details = route === "details" && Boolean(readDraft().name?.trim());
  document.querySelector("#intro-step").hidden = complete || details;
  document.querySelector("#detail-step").hidden = !details;
  document.querySelector("#complete-step").hidden = !complete;
  document.querySelector("#step").textContent = complete ? "Complete" : details ? "Step 2 of 2" : "Step 1 of 2";
  document.querySelector("#form-scroll").scrollTop = 0;
  feedback.textContent = "";
  restoreDraft();
}

function updateNetwork() {
  networkLabel.textContent = outage ? "Test outage on" : navigator.onLine ? "Online" : "Offline";
  networkToggle.textContent = outage ? "End test outage" : "Start test outage";
  networkToggle.setAttribute("aria-pressed", String(outage));
}

introForm.addEventListener("input", saveDraft);
detailForm.addEventListener("input", saveDraft);
introForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!name.value.trim()) {
    name.setCustomValidity("Enter a name.");
    name.reportValidity();
    name.setCustomValidity("");
    return;
  }
  saveDraft();
  location.hash = "details";
});

detailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = saveDraft();
  if (!draft.note.trim()) {
    feedback.textContent = "Please enter a treat box before reserving.";
    return;
  }

  submit.disabled = true;
  feedback.textContent = "Submitting…";
  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {"Content-Type": "application/json", "X-Test-Outage": outage ? "yes" : "no"},
      body: JSON.stringify(draft),
    });
    if (!response.ok) throw new Error("Submission failed");
    sessionStorage.removeItem(draftKey);
    sessionStorage.setItem(receiptKey, "yes");
    location.hash = "complete";
  } catch {
    if (regression === "offline") {
      sessionStorage.setItem(draftKey, JSON.stringify({id: draft.id, name: draft.name}));
      restoreDraft();
    }
    feedback.textContent = "Couldn’t submit. Reconnect and try again.";
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#back").addEventListener("click", () => {
  location.hash = "start";
});
networkToggle.addEventListener("click", () => {
  outage = !outage;
  sessionStorage.setItem(outageKey, outage ? "yes" : "no");
  updateNetwork();
});
document.querySelector("#reset").addEventListener("click", () => {
  if (!submit.disabled) {
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(outageKey);
    sessionStorage.removeItem(receiptKey);
    sessionStorage.removeItem(previousDraftKey);
    location.replace(location.pathname + location.search);
    restoreDraft();
    outage = false;
    updateNetwork();
    showRoute();
  }
});
window.addEventListener("online", updateNetwork);
window.addEventListener("offline", updateNetwork);
window.addEventListener("hashchange", showRoute);
document.querySelector("#build-label").textContent = Object.hasOwn(beforeLabels, regression) ? beforeLabels[regression] : "Fixed build";
updateNetwork();
const previousDraft = sessionStorage.getItem(previousDraftKey);
if (regression === "stale" && location.hash === "#details" && previousDraft) {
  sessionStorage.setItem(draftKey, previousDraft);
}
showRoute();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/offline.js").catch(() => {});
}

const evidence = document.querySelector("#evidence-status");
const runs = document.querySelector("#kane-runs");
const runButtons = document.querySelectorAll("button[data-check]");
let poll;

async function loadEvidence() {
  try {
    const response = await fetch("/api/kane-runs", {cache: "no-store"});
    if (response.status === 403) {
      runButtons.forEach((button) => { button.hidden = true; });
      evidence.textContent = "Open this page on the computer running Kane to see its local reports.";
      return;
    }
    if (!response.ok) throw new Error("Report request failed");
    const {state, runs: results} = await response.json();
    runButtons.forEach((button) => { button.disabled = state === "running"; });
    clearTimeout(poll);
    if (state === "running") poll = setTimeout(loadEvidence, 1500);
    runs.replaceChildren(...results.map((result) => {
      const card = document.createElement("article");
      card.className = "evidence-card";
      card.dataset.verdict = result.verdict ?? "missing";
      const title = document.createElement("h3");
      const verdict = {passed: "Passed", failed: "Failed", unverified: "Unverified"}[result.verdict] ?? "No verdict";
      title.textContent = result.label + " · " + verdict;
      const note = document.createElement("p");
      note.textContent = result.finding || result.summary || result.reason ||
        "Kane did not return a browser verdict for this attempt.";
      card.append(title, note);
      if (result.check) {
        const observation = document.createElement("p");
        observation.textContent = "Expected: " + result.check.expected + " · Observed: " + (result.check.observed ?? "not recorded");
        card.append(observation);
      }
      if (result.steps?.length) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "What Kane did";
        const steps = document.createElement("ol");
        for (const step of result.steps) {
          const item = document.createElement("li");
          item.textContent = (step.status === "failed" ? "Failed · " : "") + step.remark;
          steps.append(item);
        }
        details.append(summary, steps);
        card.append(details);
      }
      return card;
    }));
    if (state === "running") {
      evidence.textContent = "Kane is running the comparison. Results appear here as each run finishes.";
    } else if (state === "stopped") {
      evidence.textContent = "Comparison stopped. Check the results below. If Kane returned no verdict, check your TestMu AI sign-in.";
    } else {
      evidence.textContent = results.length ? "Results recorded by Kane CLI on this computer." :
        "No Kane runs yet. Sign in to Kane on this computer, then run the comparison.";
    }
  } catch {
    evidence.textContent = "Local Kane reports are unavailable. Reconnect and refresh.";
  }
}
for (const button of runButtons) button.addEventListener("click", async () => {
  runButtons.forEach((control) => { control.disabled = true; });
  try {
    const response = await fetch("/api/kane-" + button.dataset.check, {method: "POST", headers: {"X-Form-Survival": "run"}});
    if (!response.ok && response.status !== 409) throw new Error("Could not start Kane");
    await loadEvidence();
  } catch {
    evidence.textContent = "Could not start Kane. Check your local server and try again.";
    runButtons.forEach((control) => { control.disabled = false; });
  }
});
document.querySelector("#refresh-runs").addEventListener("click", loadEvidence);
loadEvidence();
