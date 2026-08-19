#!/bin/bash
# Fixes the deploy role's trust policy to match the renamed GitHub repo.
# Run in CloudShell: upload via Actions -> Upload file, then: bash aws-fix-trust.sh

ACCOUNT_ID=209113729339
REPO="Akishai18/SignalM"

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

aws iam update-assume-role-policy --role-name signalm-github-deploy \
  --policy-document file:///tmp/deploy-trust.json

echo "=== Trust policy now: ==="
aws iam get-role --role-name signalm-github-deploy \
  --query Role.AssumeRolePolicyDocument.Statement[0].Condition
