#!/bin/bash
# One-time IAM setup for SignalM deploys to ECS Express Mode.
# Run in AWS CloudShell: upload via Actions -> Upload file, then: bash aws-setup.sh
# Safe to re-run; "EntityAlreadyExists" errors just mean that step was already done.

ACCOUNT_ID=209113729339
REPO="Akishai18/SignalM"

echo "=== 1/4 GitHub OIDC provider ==="
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

echo "=== 2/4 Deploy role (assumed by GitHub Actions) ==="
cat > /tmp/deploy-trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:${REPO}:*" }
    }
  }]
}
EOF

cat > /tmp/deploy-permissions.json <<'EOF'
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
EOF

aws iam create-role --role-name signalm-github-deploy \
  --assume-role-policy-document file:///tmp/deploy-trust.json
aws iam put-role-policy --role-name signalm-github-deploy \
  --policy-name deploy --policy-document file:///tmp/deploy-permissions.json

echo "=== 3/4 Task execution role (ECS pulls image, writes logs) ==="
cat > /tmp/ecs-tasks-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name signalm-ecs-execution \
  --assume-role-policy-document file:///tmp/ecs-tasks-trust.json
aws iam attach-role-policy --role-name signalm-ecs-execution \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

echo "=== 4/4 Infrastructure role (Express Mode manages ALB/networking) ==="
cat > /tmp/ecs-infra-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name signalm-ecs-infrastructure \
  --assume-role-policy-document file:///tmp/ecs-infra-trust.json
aws iam attach-role-policy --role-name signalm-ecs-infrastructure \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices

echo
echo "=== Done. Roles: ==="
aws iam list-roles --query "Roles[?starts_with(RoleName,'signalm')].Arn" --output table
