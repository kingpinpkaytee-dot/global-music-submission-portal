# Hourly global opportunity discovery

The GitHub Actions workflow `.github/workflows/hourly-opportunity-discovery.yml` runs at minute 17 of every hour and can also be started manually.

## One-time repository secrets

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `SUPABASE_URL`: `https://mdcvewnevgsgmyfnybgn.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase project's service-role key. Keep this private; never put it in source code or a chat.
- `GOOGLE_CSE_API_KEY`: API key for Google Custom Search JSON API.
- `GOOGLE_CSE_ID`: the Programmable Search Engine ID configured to search the web.

Google Custom Search JSON API quota and billing/availability are controlled by Google. The worker currently performs four category searches per hourly run.

## Database deployment

From the project root, with the Supabase CLI linked and authenticated:

```powershell
npx supabase@latest db push --linked
```

This applies any outstanding migrations in order, including migration 0021 (previously committed) and migration 0022 (hourly discovery audit tables). Confirm with:

```powershell
npx supabase@latest migration list --linked
```

## Run and monitor

Open **Actions → Hourly Global Opportunity Discovery → Run workflow** for the first manual run. The same workflow then runs hourly.

Each execution writes an audit row to `opportunity_discovery_runs` and candidate evidence to `opportunity_discovery_candidates`. Candidates without reachable pages and explicit submission evidence are rejected and never promoted. The worker deduplicates by category and name before updating or inserting public directory records.

A successful GitHub workflow run is required before describing hourly automation as live. Search quota exhaustion, missing secrets, or database errors appear in the Actions run log.
