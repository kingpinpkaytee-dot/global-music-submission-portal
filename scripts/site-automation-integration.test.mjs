import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../index.html");
const app = read("../src/app.js");
const auth = read("../src/auth.js");
const worker = read("./hourly-opportunity-discovery.mjs");
const migration28 = read("../supabase/migrations/0028_autonomous_verified_opportunity_publication.sql");
const migration29 = read("../supabase/migrations/0029_harden_autonomous_playlist_publication.sql");
const workflow = read("../.github/workflows/hourly-opportunity-discovery.yml");

test("embedded website routing scripts parse as JavaScript", () => {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\btype=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1, "expected at least one inline script");
  for (const [, source] of scripts) new vm.Script(source, { filename: "index.html:inline-script" });
});

test("Premium pricing routes from public navigation and dashboard", () => {
  assert.ok(html.includes('href="#premium-access"'));
  assert.ok(html.includes('id="premium-access"'));
  assert.ok(html.includes('premium: "premium-access"'));
  assert.ok(html.includes('href="?view=premium"'));
  assert.ok(html.includes("R99"));
  assert.ok(html.includes("Premium activation pending"));
  assert.ok(html.includes("PRE-LAUNCH STATUS"));
});

test("Premium checkout is not exposed as an enabled purchase before billing launch", () => {
  assert.match(html, /<button[^>]*disabled[^>]*>Premium activation pending<\/button>/);
  assert.match(html, /recurring billing[^<]*must pass production tests/i);
});

test("website directory reader displays only active, verified public records", () => {
  const start = app.indexOf("async function loadDirectory()");
  const end = app.indexOf("async function loadPublicStats()", start);
  assert.ok(start >= 0 && end > start, "loadDirectory function must exist");
  const source = app.slice(start, end);
  assert.ok(source.includes('from("opportunity_directories")'));
  assert.ok(source.includes('.eq("is_public", true)'));
  assert.ok(source.includes('.eq("is_active", true)'));
  assert.ok(source.includes('.eq("is_verified", true)'));
  assert.ok(source.includes("follower_count") && source.includes("response_rate"));
});

test("automation stages candidates then invokes the guarded publication RPC", () => {
  assert.ok(worker.includes('rest("opportunity_discovery_candidates"'));
  assert.ok(worker.includes('rest("rpc/auto_publish_verified_opportunity_candidate"'));
  assert.ok(worker.includes("if(ev.ok&&corroboration.ok&&autoPublicationEnabled)"));
  assert.ok(worker.includes("AUTOPUBLISH_DISABLED"));
});

test("publication migrations bridge verified candidates into the website directory", () => {
  assert.ok(migration28.includes("ADD COLUMN IF NOT EXISTS auto_verification jsonb"));
  assert.ok(migration28.includes("CREATE OR REPLACE FUNCTION public.auto_publish_verified_opportunity_candidate"));
  assert.ok(migration29.includes("CREATE TABLE IF NOT EXISTS public.opportunity_discovery_runtime_config"));
  assert.ok(migration29.includes("INSERT INTO public.opportunity_directories"));
  assert.ok(migration29.includes("is_verified,is_active,is_public"));
  assert.ok(migration29.includes("activity_status,follower_count,response_rate"));
  assert.ok(migration29.includes("is_integrated,accepts_submissions"));
});

test("publication migration is one complete transaction with a closed Spotify URL guard", () => {
  const commits = migration29.match(/\bCOMMIT;/g) || [];
  const functions = migration29.match(/CREATE OR REPLACE FUNCTION/g) || [];
  assert.equal(commits.length, 1, "migration must have exactly one COMMIT");
  assert.equal(functions.length, 1, "migration must have exactly one publication function");
  const playlistGuard = migration29.split("\n").find(line =>
    line.includes("individual_playlist_url") && line.includes("!~*")
  );
  assert.ok(playlistGuard, "individual Spotify playlist URL guard must exist");
  assert.ok(playlistGuard.trimEnd().endsWith("$'"), "Spotify URL regex must be closed and anchored");
  assert.ok(migration29.trimEnd().endsWith("COMMIT;"), "no stray SQL should follow COMMIT");
});

test("website ES modules pass Node syntax checks", () => {
  const temp = mkdtempSync(join(tmpdir(), "artist-frequency-esm-"));
  try {
    for (const path of ["src/app.js", "src/auth.js"]) {
      const syntaxFile = join(temp, path.split("/").at(-1).replace(/\\.js$/, ".mjs"));
      writeFileSync(syntaxFile, read("../" + path), "utf8");
      const result = spawnSync(process.execPath, ["--check", syntaxFile], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout || path + " failed syntax check");
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("GitHub Actions runs this integration suite on main pushes", () => {
  assert.match(workflow, /on:\s*[\s\S]*push:/);
  assert.ok(workflow.includes("node --test scripts/site-automation-integration.test.mjs"));
});
