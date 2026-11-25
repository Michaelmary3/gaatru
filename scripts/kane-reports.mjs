import { readdir, readFile } from "node:fs/promises";

export const projectRoot = new URL("../", import.meta.url);
export const reportsRoot = new URL("reports/", projectRoot);
const evidenceRoot = new URL("evidence/", projectRoot);

async function runDirectories(root) {
  const entries = await readdir(root, {withFileTypes: true}).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => [entry.name, root]);
}

export async function recentKaneRuns({tickets = false} = {}) {
  const archived = tickets ? await runDirectories(evidenceRoot) : [];
  const local = await runDirectories(reportsRoot);
  const locations = new Map([...local, ...archived]);
  const names = [...locations.keys()]
    .filter((name) => (tickets ? /^ticket-(?:retry|refund)-(?:before|after|check)-\d+$/
      : /^(?:(?:back|offline|stale)-(?:before|fixed)|custom)-\d+$/).test(name))
    .sort((a, b) => b.slice(b.lastIndexOf("-") + 1).localeCompare(a.slice(a.lastIndexOf("-") + 1)))
    .slice(0, 12);
  const rows = await Promise.all(names.map(async (name) => {
    try {
      const data = JSON.parse(await readFile(new URL(name + "/result.json", locations.get(name)), "utf8"));
      const label = name.slice(0, name.lastIndexOf("-")).replaceAll("-", " ");
      return {label, verdict: data.verdict, summary: data.kaneFinding ?? data.summary, reason: data.reason,
        finding: data.findings?.[0]?.remark, steps: data.steps?.slice(0, 40), check: data.check,
        verification: data.verification, kaneVerdict: data.kaneVerdict};
    } catch {
      return null;
    }
  }));
  return rows.filter(Boolean);
}
