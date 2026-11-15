# Supabase publication migrations — application record

Date: 2026-11-15

## Operator confirmation

The project operator confirmed that the combined SQL script
`ArtistFrequency_Apply_Migrations_0028_0029.sql` completed successfully in the
Supabase SQL Editor with the message "Success. No rows returned."

The script contains migrations 0028 and 0029 in separate transactions.

## Post-application schema-cache check

A read-only request to the PostgREST relation
`public.opportunity_discovery_runtime_config` returned HTTP 401 with PostgreSQL
error `42501` ("permission denied for table opportunity_discovery_runtime_config").

This is consistent with the intended migration state: the relation is present
in the PostgREST schema cache, while the anonymous role is denied access by the
migration's explicit privilege revocation. Before application, the worker
reported PostgREST `PGRST205` because this relation was absent from the schema
cache.

The check does not exercise the service-role publication RPC and is not proof
that any candidate has been published.

## Next verification

The hourly GitHub Actions workflow is triggered on pushes to `main` and by
its hourly schedule. The next run must be inspected for:

- absence of `AUTOPUBLISH_DISABLED` and `PGRST205`;
- successful access to the runtime configuration using the workflow's
  service-role secret;
- exact discovered, queued, rejected, duplicate, and published counts.

A candidate is counted as published only when the worker confirms a successful
directory publication. Zero qualified candidates is a valid outcome and must
not be represented as a successful import.
