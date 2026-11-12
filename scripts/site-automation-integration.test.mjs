import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  const scripts = [...html.matchAll(/<script\\b(?![^>]*\\btype=["']module["'])[^>]*>([\\s\\S]*?)<\\/script>/gi)];
  assert.ok(scripts.length >= 1, "expected at least one inline script");
  for (const [, source] of scripts) new vm.Script(source, { filename: "index.html:inline-script" });
});

test("Premium pricing routes from public navigation and dashboard", () => {
  assert.match(html, /href="#premium-access"/);
  assert.match(html, /id="premium-access"/);
  assert.match(html, /premium:\\s*"premium-access"/);
  assert.match(html, /href="\\?view=premium"/);
  assert.match(html, /R99/);
  assert.match(html, /Premium activation pending/);
  assert.match(html, /PRE-LAUNCH STATUS/);
});

test("Premium checkout is not exposed as an enabled purchase before billing launch", () => {
  assert.match(html, /<button[^>]*disabled[^>]*>Premium activation pending<\\/button>/);
  assert.match(html, /recurring billing[^<]*must pass production tests/i);
});

test("website directory reader displays only active, verified public records", () => {
  const start = app.indexOf("async function loadDirectory()");
  const end = app.indexOf("async function loadPublicStats()", start);
  assert.ok(start >= 0 && end > start, "loadDirectory function must exist");
  const source = app.slice(start, end);
  assert.match(source, /from\\("opportunity_directories"\\)/);
  assert.match(source, /\\.eq\\("is_public", true\\)/);
  assert.match(source, /\\.eq\\("is_active", true\\)/);
  assert.match(source, /\\.eq\\("is_verified", true\\)/);
  assert.match(source, /follower_count,response_rate/);
});

test("automation stages candidates then invokes the guarded publication RPC", () => {
  assert.match(worker, /rest\\("opportunity_discovery_candidates"/);
  assert.match(worker, /rest\\("rpc\\/auto_publish_verified_opportunity_candidate"/);
  assert.match(worker, /if\\(ev\\.ok&&corroboration\\.ok&&autoPublicationEnabled\\)/);
  assert.match(worker, /AUTOPUBLISH_DISABLED/);
});

test("publication migrations bridge verified candidates into the website directory", () => {
  assert.match(migration28, /ADD COLUMN IF NOT EXISTS auto_verification jsonb/);
  assert.match(migration28, /CREATE OR REPLACE FUNCTION public\\.auto_publish_verified_opportunity_candidate/);
  assert.match(migration29, /CREATE TABLE IF NOT EXISTS public\\.opportunity_discovery_runtime_config/);
  assert.match(migration29, /INSERT INTO public\\.opportunity_directories/);
  assert.match(migration29, /is_verified,is_active,is_public/);
  assert.match(migration29, /activity_status,follower_count,response_rate/);
  assert.match(migration29, /is_integrated,accepts_submissions/);
});

test("publication migration is one complete transaction with the canonical Spotify URL guard", () => {
  const commits = migration29.match(/\\bCOMMIT;\\b/g) || [];
  const functions = migration29.match(/CREATE OR REPLACE FUNCTION/g) || [];
  assert.equal(commits.length, 1, "migration must have exactly one COMMIT");
  assert.equal(functions.length, 1, "migration must have exactly one publication function");
  assert.match(migration29, /individual_playlist_url[^\\n]*!~\\* '\\^https:\\/\\/open\\[\\.\\]spotify\\[\\.\\]com\\/playlist\\/\\[A-Za-z0-9\\]\\+\\(\\[\\/?#\\]\\.\\*\\)\\?\\$'/);
  assert.ok(migration29.trimEnd().endsWith("COMMIT;"), "no stray SQL should follow COMMIT");
});

test("website ES modules pass Node syntax checks", () => {
  for (const path of ["src/app.js", "src/auth.js"]) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || path + " failed syntax check");
  }
});

test("GitHub Actions runs this integration suite on main pushes", () => {
  assert.match(workflow, /on:\\s*[\\s\\S]*push:/);
  assert.match(workflow, /node --test scripts\\/site-automation-integration\\.test\\.mjs/);
});
