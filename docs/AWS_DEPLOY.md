# Deploying the SignalM API to AWS (Lightsail Containers)

The API runs on an **Amazon Lightsail container service** (`signalm-api`,
nano power: 0.25 vCPU / 512 MB, flat $7/month including the HTTPS URL).
Chosen over ECS Express Mode because Express fronts every service with a
dedicated ALB (~$20/month fixed) — 3× the cost for this low-traffic API.
App Runner would have been the middle ground but stopped accepting new
customers on 2026-04-30.

Everything is driven by `.github/workflows/deploy_api.yml`: it builds the
`Dockerfile`, pushes the image to the `signalm-api` ECR repo, and creates a
Lightsail deployment pointing at that image. It runs on every push to
`main` **and** is called by `daily_refresh.yml` after the weekday data
commit (that call is required — pushes made with `GITHUB_TOKEN` never fire
`on: push` workflows, so without it the API would keep serving stale data).

## One-time setup (already done for this account)

1. **ECR + GitHub OIDC + deploy role** — created by `aws-setup.sh` (run it
   in CloudShell). Creates the `signalm-api` ECR repo, the GitHub OIDC
   identity provider, and the `signalm-github-deploy` role that the
   workflow assumes. The role's trust policy is pinned to this repo's
   GitHub path — if the repo is ever renamed again, re-run
   `aws-fix-trust.sh` with the new name.
2. **Lightsail service** — created by `aws-lightsail-setup.sh` (run it in
   CloudShell). Creates the nano container service, enables its ECR image
   puller role, grants that role pull access on the repo, adds Lightsail
   deploy permissions to `signalm-github-deploy`, and sets an ECR lifecycle
   rule (keep last 5 images). Prints the service URL when done.
3. **GitHub repo settings** (Settings → Secrets and variables → Actions):
   - Variables: `AWS_REGION` = `us-east-1`,
     `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::209113729339:role/signalm-github-deploy`
   - Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the service-role
     secret, never the anon key)

## Verify a deploy

The service URL looks like
`https://signalm-api.<id>.us-east-1.cs.amazonlightsail.com`
(Lightsail console → Containers → `signalm-api`, or the last line of
`aws-lightsail-setup.sh` output).

- `<url>/api/health` → `"status": "healthy"` with a date range ending at
  the latest refresh date
- `<url>/api/debug/precomputed` → `exists: true` with a nonzero file count

The frontend finds the API via `VITE_API_URL` in Vercel (no trailing
slash); changing it requires a frontend redeploy.

## Cost

Flat **$7/month** (nano) + pennies for ECR storage and data transfer
(500 GB/month included). If the API feels slow or hits memory limits,
bump `--power` (micro $10 = 1 GB RAM, small $15 = 0.5 vCPU/1 GB) via
`aws lightsail update-container-service` — no workflow change needed.

## History / dead ends

- **App Runner** (first plan): closed to new customers 2026-04-30.
- **ECS Express Mode** (second plan, briefly live Aug 2026): worked, but
  cost ~$1.70/day at idle due to the dedicated ALB + public IPv4 charges.
  Torn down; the IAM roles (`signalm-ecs-execution`,
  `signalm-ecs-infrastructure`) may still exist — they're free and unused.
