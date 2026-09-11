#!/bin/bash
# One-time setup for hosting the SignalM API on Lightsail Containers ($7/mo nano).
# Run in AWS CloudShell: upload via Actions -> Upload file, then: bash aws-lightsail-setup.sh
# Safe to re-run; "already exists" errors mean that step was previously done.

export AWS_PAGER=""
REGION=us-east-1
SERVICE=signalm-api
REPO=signalm-api

echo "=== 1/5 Create Lightsail container service (nano: 0.25 vCPU, 512 MB, \$7/mo) ==="
aws lightsail create-container-service --service-name $SERVICE \
  --power nano --scale 1 --region $REGION

echo "=== 2/5 Wait for service to be ready (takes a few minutes) ==="
for i in $(seq 1 60); do
  STATE=$(aws lightsail get-container-services --service-name $SERVICE \
    --region $REGION --query 'containerServices[0].state' --output text)
  echo "  state: $STATE"
  if [ "$STATE" = "READY" ] || [ "$STATE" = "RUNNING" ]; then break; fi
  sleep 10
done

echo "=== 3/5 Enable the ECR image puller role ==="
aws lightsail update-container-service --service-name $SERVICE \
  --private-registry-access ecrImagePullerRole={isActive=true} --region $REGION

PRINCIPAL=None
for i in $(seq 1 12); do
  sleep 10
  PRINCIPAL=$(aws lightsail get-container-services --service-name $SERVICE --region $REGION \
    --query 'containerServices[0].privateRegistryAccess.ecrImagePullerRole.principalArn' --output text)
  if [ "$PRINCIPAL" != "None" ] && [ -n "$PRINCIPAL" ]; then break; fi
  echo "  waiting for puller role principal..."
done
echo "  puller principal: $PRINCIPAL"
if [ "$PRINCIPAL" = "None" ] || [ -z "$PRINCIPAL" ]; then
  echo "ERROR: puller role principal never appeared; re-run this script in a minute."
  exit 1
fi

echo "=== 4/5 Allow the puller role to pull from the ECR repo ==="
cat > /tmp/ecr-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowLightsailPull",
    "Effect": "Allow",
    "Principal": { "AWS": "${PRINCIPAL}" },
    "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ]
  }]
}
EOF
aws ecr set-repository-policy --repository-name $REPO \
  --policy-text file:///tmp/ecr-policy.json --region $REGION

echo "=== 5/5 Grant the GitHub deploy role Lightsail permissions + ECR image cleanup ==="
cat > /tmp/lightsail-deploy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "lightsail:CreateContainerServiceDeployment",
      "lightsail:GetContainerServices",
      "lightsail:GetContainerServiceDeployments"
    ],
    "Resource": "*"
  }]
}
EOF
aws iam put-role-policy --role-name signalm-github-deploy \
  --policy-name lightsail-deploy --policy-document file:///tmp/lightsail-deploy.json

cat > /tmp/ecr-lifecycle.json <<'EOF'
{
  "rules": [{
    "rulePriority": 1,
    "description": "keep only the 5 most recent images",
    "selection": {
      "tagStatus": "any",
      "countType": "imageCountMoreThan",
      "countNumber": 5
    },
    "action": { "type": "expire" }
  }]
}
EOF
aws ecr put-lifecycle-policy --repository-name $REPO \
  --lifecycle-policy-text file:///tmp/ecr-lifecycle.json --region $REGION

echo
echo "=== Done. Lightsail service URL (save this for Vercel): ==="
aws lightsail get-container-services --service-name $SERVICE \
  --region $REGION --query 'containerServices[0].url' --output text
