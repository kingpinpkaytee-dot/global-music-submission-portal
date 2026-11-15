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
const migration30 = read("../supabase/migrations/0030_playlist_minimum_followers_15.sql");
const workflow = read("../.github/workflows/hourly-opportunity-discovery.yml");

test("embedded website routing scripts parse as JavaScript", () => {
  const scripts = [...html.matchAll(/<script\b(?![^>]*\btype=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1, "expected at least one inline script");
  for (const [, source] of scripts) new vm.Script(source, { filename: "index.html:inline-script" });
});

test("internal Artist Frequency navigation always replaces the current tab", () => {
  const internalRouteAnchors = [...html.matchAll(/<a\\b[^>]*href=["']\\?view=[^"']+["'][^>]*>/gi)].map(match => match[0]);
  assert.ok(internalRouteAnchors.length >= 10, "expected dashboard, workspace and navigation route links");
  for (const anchor of internalRouteAnchors) {
    assert.doesNotMatch(anchor, /target=["'](?:_blank|artistFrequencyPopup)["']/i, anchor);
  }
  assert.ok(!html.includes('brand.target = "_blank"'), "brand navigation must not force a new tab");
  const navInjectionAt = html.indexOf("navActions.innerHTML");
  assert.ok(navInjectionAt >= 0, "focused-view navigation must still be generated");
  const navInjection = html.slice(navInjectionAt, navInjectionAt + 400);
  assert.doesNotMatch(navInjection, /target=["'](?:_blank|artistFrequencyPopup)["']/i);

  const handlerStart = app.indexOf('document.addEventListener("click"');
  const handlerEnd = app.indexOf("const byId", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, "same-origin navigation handler must exist");
  const handler = app.slice(handlerStart, handlerEnd);
  assert.ok(handler.includes("destination.origin === window.location.origin"));
  assert.ok(handler.includes("if (isInternalRoute)"));
  assert.ok(handler.includes("window.location.assign(destination.href)"));
  assert.ok(handler.indexOf("if (isInternalRoute)") < handler.indexOf("window.open("),
    "same-origin route handling must occur before any popup creation");
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
  assert.ok(source.includes("data || []).filter(isEligiblePublicPlaylist"));
});

test("public playlist listings enforce the required metrics and destination URLs", () => {
  const start = app.indexOf("function isEligiblePublicPlaylist(item)");
  const end = app.indexOf("\nfunction renderOpportunityCards", start);
  assert.ok(start >= 0 && end > start, "public playlist eligibility helper must exist");
  const context = vm.createContext({});
  vm.runInContext(app.slice(start, end), context);
  const eligible = context.isEligiblePublicPlaylist;
  const valid = {
    category: "playlist",
    follower_count: 15,
    response_rate: 0.5,
    activity_status: "active",
    website_url: "https://open.spotify.com/playlist/2OUUjU1AmIw5OoDHk47DAi",
    submission_url: "https://curator.example/submit"
  };
  assert.equal(eligible(valid), true);
  assert.equal(eligible({ ...valid, follower_count: 14 }), false);
  assert.equal(eligible({ ...valid, response_rate: 0 }), false);
  assert.equal(eligible({ ...valid, response_rate: 100.1 }), false);
  assert.equal(eligible({ ...valid, activity_status: "unknown" }), false);
  assert.equal(eligible({ ...valid, website_url: "https://open.spotify.com/" }), false);
  assert.equal(eligible({ ...valid, submission_url: "http://curator.example/submit" }), false);
  assert.equal(eligible({ ...valid, category: "radio_station" }), true);
});

test("playlist statistics enforce the same follower, response and activity thresholds", () => {
  const start = app.indexOf("async function updateOpportunityStats()");
  const end = app.indexOf("async function loadDirectory()", start);
  assert.ok(start >= 0 && end > start, "opportunity statistics function must exist");
  const source = app.slice(start, end);
  assert.ok(source.includes('.gte("follower_count", 15)'));
  assert.ok(source.includes('.gte("response_rate", 0.5)'));
  assert.ok(source.includes('.lte("response_rate", 100)'));
  assert.ok(source.includes('.eq("activity_status", "active")'));
  assert.ok(source.includes('.like("website_url", "https://open.spotify.com/playlist/%")'));
  assert.ok(source.includes('.like("submission_url", "https://%")'));
});

test("automation stages candidates then invokes the guarded publication RPC", () => {
  assert.ok(worker.includes('rest("opportunity_discovery_candidates"'));
  assert.ok(worker.includes('rest("rpc/auto_publish_verified_opportunity_candidate"'));
  assert.ok(worker.includes("if(ev.ok&&corroboration.ok&&autoPublicationEnabled)"));
  assert.ok(worker.includes("AUTOPUBLISH_DISABLED"));
});

test("discovery prioritizes first-party curator sources and runs bounded independent corroboration", () => {
  assert.ok(worker.includes("at least 15 followers"));
  assert.ok(worker.includes('Math.min(4,requestedSearches)'));
  assert.ok(worker.includes("site:housemusicwithlove.com/spotify-playlists"));
  assert.ok(worker.includes("site:qrtrplaylists.com"));
  assert.ok(worker.includes("site:pitchplaylists.com"));
  assert.ok(worker.includes("site:dailyplaylists.com/blog"));
  assert.ok(worker.includes('expectedDomain:"housemusicwithlove.com"'));
  assert.ok(worker.includes('expectedDomain:"qrtrplaylists.com"'));
  assert.ok(worker.includes('expectedDomain:"pitchplaylists.com"'));
  assert.ok(worker.includes('expectedDomain:"dailyplaylists.com"'));
  assert.ok(worker.includes("sourceQueryDiagnostics.push"));
  assert.ok(worker.includes("play.google.com"));
  assert.ok(worker.includes("crazygames.com"));
  const querySource = worker.slice(worker.indexOf("const playlistQueries="), worker.indexOf("const queries="));
  assert.ok(!querySource.includes('"followers" OR "response rate"'), "metrics must be inspected after discovery, not required in search snippets");
  assert.ok(worker.includes("searchesRemaining:4,searchesUsed:0"));
  assert.ok(worker.includes("corroborationSearchesUsed:corroborationBudget.searchesUsed"));
  assert.ok(workflow.includes('DISCOVERY_SEARCHES_PER_RUN: "4"'));
});

test("migration 0030 updates both database follower guards to an inclusive 15 minimum", () => {
  assert.ok(migration30.includes("candidate.follower_count <= 100"));
  assert.ok(migration30.includes("candidate.follower_count < 15"));
  assert.ok(migration30.includes("coalesce((evidence->>'follower_count')::bigint,0) <= 100"));
  assert.ok(migration30.includes("coalesce((evidence->>'follower_count')::bigint,0) < 15"));
  assert.ok(migration30.includes("at least 15 followers"));
  assert.ok(migration30.trimEnd().endsWith("COMMIT;"));
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
      const syntaxFile = join(temp, path.split("/").at(-1).replace(".js", ".mjs"));
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
