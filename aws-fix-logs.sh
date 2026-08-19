#!/bin/bash
# Grants the ECS Express infrastructure role the CloudWatch Logs permissions
# it needs to create/inspect the service's log group.
# Run in CloudShell: upload via Actions -> Upload file, then: bash aws-fix-logs.sh

# The managed policy lives under the service-role/ path — the original setup
# script omitted it, so the attach silently failed and the role had no perms
aws iam attach-role-policy --role-name signalm-ecs-infrastructure \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices

cat > /tmp/infra-logs.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogGroup",
      "logs:DescribeLogGroups",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "logs:ListTagsForResource"
    ],
    "Resource": "*"
  }]
}
EOF

aws iam put-role-policy --role-name signalm-ecs-infrastructure \
  --policy-name cloudwatch-logs --policy-document file:///tmp/infra-logs.json

echo "=== Policies now on the infrastructure role: ==="
aws iam list-attached-role-policies --role-name signalm-ecs-infrastructure --output table
aws iam list-role-policies --role-name signalm-ecs-infrastructure --output table
