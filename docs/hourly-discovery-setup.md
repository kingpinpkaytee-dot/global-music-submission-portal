# Hourly global opportunity discovery

The GitHub Actions workflow `.github/workflows/hourly-opportunity-discovery.yml` runs at minute 17 of every hour and can also be started manually.

## GitHub Actions configuration

Open **Settings → Secrets and variables → Actions**.

Create these **repository variables** (non-secret configuration):

- `SUPABASE_URL`: `https://mdcvewnevgsgmyfnybgn.supabase.co`
- `GOOGLE_CSE_ID`: `d54a5ff6d8afc44d4`

Create these **repository secrets** (credentials; never store them as Variables or commit them):

- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key.
- `GOOGLE_CSE_API_KEY`: the Google Custom Search JSON API key.

The workflow reads the first two from `vars.*` and the credentials from `secrets.*`. If either credential was previously placed in repository Variables, delete that variable and recreate it under **Secrets**. Rotate the credential if it was exposed in a public repository, log, or other untrusted location.

Google controls Custom Search JSON API availability, quota and billing. The worker currently performs four category searches per hourly run.

## Database deployment

From the project root, with the Supabase CLI linked and authenticated:

```powershell
npx supabase@latest db push --linked
```

Confirm migration state with:

```powershell
npx supabase@latest migration list --linked
```

## Run and monitor

Open **Actions → Hourly Global Opportunity Discovery → Run workflow** for the first manual run. The same workflow then runs hourly.

Each execution writes a run record to `hourly_opportunity_discovery_runs` and candidate evidence to `hourly_opportunity_discovery_candidates`. A successful GitHub Actions run is required before describing hourly automation as live. Missing configuration, API quota exhaustion, or database errors appear in the Actions run log.

**Verification caution:** A search result or reachable page is not sufficient proof that an opportunity is active, free, or currently accepting submissions. Review candidates and their direct submission evidence before treating them as verified public opportunities.
