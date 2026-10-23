import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the 2026-09-23 production deploy failure (run 35920190398):
// cloudflare/wrangler-action infers its package manager from bun.lock and tried to
// run `bun` in a job that never installed it. Line-based on purpose (no YAML
// dependency in this repo); actionlint covers syntax separately.

const WORKFLOW_DIR = path.resolve(__dirname, "../../.github/workflows");
const workflows = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".yml"));

function jobsOf(source: string): { name: string; body: string }[] {
  const lines = source.split("\n");
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const jobs: { name: string; body: string[] }[] = [];
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) jobs.push({ name: header[1], body: [] });
    else if (jobs.length) jobs[jobs.length - 1].body.push(line);
  }
  return jobs.map((j) => ({ name: j.name, body: j.body.join("\n") }));
}

/** The `with:` block of each wrangler-action step in a job, up to the next step. */
function wranglerSteps(jobBody: string): string[] {
  return jobBody
    .split(/\n(?=\s*- (?:name|uses|run):)/)
    .filter((step) => /uses:\s*cloudflare\/wrangler-action@/.test(step));
}

describe("deploy workflows", () => {
  it("covers the production and staging workflows", () => {
    expect(workflows).toEqual(expect.arrayContaining(["production.yml", "staging.yml"]));
  });

  for (const file of workflows) {
    const source = readFileSync(path.join(WORKFLOW_DIR, file), "utf8");

    it(`${file}: does not use the archived cloudflare/pages-action`, () => {
      expect(source).not.toMatch(/uses:\s*cloudflare\/pages-action/);
    });

    for (const job of jobsOf(source)) {
      const installsBun = /uses:\s*oven-sh\/setup-bun@/.test(job.body);

      it(`${file} › ${job.name}: wrangler-action never falls back to an uninstalled bun`, () => {
        for (const step of wranglerSteps(job.body)) {
          expect(step).toMatch(/packageManager:\s*npm\b/);
          expect(step).toMatch(/wranglerVersion:\s*"\d+\.\d+\.\d+"/);
        }
      });

      it(`${file} › ${job.name}: bun commands only run where bun is installed`, () => {
        const runsBun = /run:\s*(?:\|\s*\n[\s\S]*?)?\bbunx?\s/.test(job.body);
        if (runsBun) expect(installsBun).toBe(true);
      });
    }
  }
});
