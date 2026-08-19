# Deploying the SignalM API to AWS (ECS Express Mode)

Replaces Render as the backend host. App Runner stopped accepting new
customers on 2026-04-30, so this uses AWS's recommended successor, **Amazon
ECS Express Mode**: a Fargate container behind a managed ALB with TLS, a
public URL, and auto-scaling — all created from a single deploy action.

Everything is driven by `.github/workflows/deploy_api.yml`:
it builds the `Dockerfile`, pushes the image to ECR, and creates/updates the
Express service. It runs on every push to `main` **and** is called by
`daily_refresh.yml` after the weekday data commit (that call is required —
pushes made with `GITHUB_TOKEN` never fire `on: push` workflows, so without
it the API would keep serving stale data).

## One-time setup

All commands assume region `us-east-1`; substitute your own. `<ACCOUNT_ID>`
is your 12-digit AWS account ID, `<GH_USER>/<REPO>` is this repo's GitHub
path.

### 1. ECR repository

```bash
aws ecr create-repository --repository-name signalm-api --region us-east-1
```

### 2. GitHub OIDC provider (lets Actions assume an AWS role, no stored keys)

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

### 3. IAM roles (three)

**a. Deploy role** — assumed by GitHub Actions. Trust policy
(`deploy-trust.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:<GH_USER>/<REPO>:*" }
    }
  }]
}
```

Permissions policy (`deploy-permissions.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:CreateCluster", "ecs:RegisterTaskDefinition",
        "ecs:CreateExpressGatewayService", "ecs:UpdateExpressGatewayService",
        "ecs:DescribeExpressGatewayService", "ecs:DescribeClusters",
        "ecs:DescribeServices", "ecs:ListServiceDeployments",
        "ecs:DescribeServiceDeployments", "ecs:TagResource",
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken", "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload", "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

```bash
aws iam create-role --role-name signalm-github-deploy \
  --assume-role-policy-document file://deploy-trust.json
aws iam put-role-policy --role-name signalm-github-deploy \
  --policy-name deploy --policy-document file://deploy-permissions.json
```

**b. Task execution role** — lets ECS pull the image and write logs:

```bash
aws iam create-role --role-name signalm-ecs-execution \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name signalm-ecs-execution \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

**c. Infrastructure role** — lets Express Mode manage the ALB and networking:

```bash
aws iam create-role --role-name signalm-ecs-infrastructure \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name signalm-ecs-infrastructure \
  --policy-arn arn:aws:iam::aws:policy/AmazonECSInfrastructureRoleforExpressGatewayServices
```

### 4. GitHub repo settings (Settings → Secrets and variables → Actions)

Variables:

| Variable | Value |
| --- | --- |
| `AWS_REGION` | `us-east-1` |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/signalm-github-deploy` |
| `ECS_EXECUTION_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/signalm-ecs-execution` |
| `ECS_INFRA_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/signalm-ecs-infrastructure` |

Secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` — copy the values from
the Render dashboard (the service-role secret, never the anon key).

### 5. First deploy

Actions tab → **Deploy API to ECS Express** → **Run workflow**. The first
run creates the cluster, service, ALB, and TLS endpoint (takes several
minutes). Find the **Application URL** in the ECS console → Clusters →
`default` → `signalm-api`.

## Verify

- `https://<application-url>/api/health` → `"status": "healthy"` with a date
  range ending at the latest refresh date
- `https://<application-url>/api/debug/precomputed` → `exists: true` with a
  nonzero file count

## Point the frontend at AWS

In the Vercel project settings, set `VITE_API_URL` to the Application URL
(no trailing slash) and redeploy the frontend. CORS needs no change — the
API currently allows all origins.

## Decommission Render

After a few days of the daily cycle working end-to-end (refresh Action
pushes → deploy job builds → `/api/health` shows the new date), suspend or
delete the Render service.

## Cost

At 0.25 vCPU / 512 MB Fargate (~$9/mo, sized to match the old Render
instance) plus the ALB (~$16–20/mo), expect **roughly $25–30/month** — the
ALB's fixed hourly price is most of it. Check the billing console after the
first week; if the 6-month free credits are the $100–200 kind, this will
consume them before the 6 months are up. If cost becomes the constraint,
the same Docker image runs on Lightsail Containers (~$7/mo, no ALB) or back
on Render's free tier — nothing in the repo is ECS-specific except
`deploy_api.yml`.

If the API feels slow or gets OOM-killed (watch for restarting tasks in the
ECS console), bump `cpu`/`memory` in `deploy_api.yml`. Valid Fargate pairs
near this size: 256/512, 256/1024, 512/1024, 512/2048, 1024/2048.
