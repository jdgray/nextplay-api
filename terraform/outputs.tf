output "vpc_id" {
  description = "ID of the VPC the Aurora cluster lives in."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs backing the DB subnet group. Feed these into serverless.yml's --param:privateSubnetIds (comma-separated)."
  value       = aws_subnet.private[*].id
}

output "aurora_security_group_id" {
  description = "Security group ID allowing Postgres access to the cluster. Once the Lambda security group exists, authorize it against this one."
  value       = aws_security_group.aurora.id
}

output "cluster_identifier" {
  description = "Aurora cluster identifier. Feed into serverless.yml's --param:existingAuroraClusterIdentifier for the RDS Proxy target group."
  value       = aws_rds_cluster.aurora.cluster_identifier
}

output "cluster_endpoint" {
  description = "Writer endpoint of the Aurora cluster."
  value       = aws_rds_cluster.aurora.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint of the Aurora cluster."
  value       = aws_rds_cluster.aurora.reader_endpoint
}

output "cluster_port" {
  description = "Port Postgres is listening on."
  value       = aws_rds_cluster.aurora.port
}

output "master_user_secret_arn" {
  description = "ARN of the RDS-managed Secrets Manager secret holding the master credentials. Feed into serverless.yml's --param:dbSecretArn for the RDS Proxy's Auth block."
  value       = aws_rds_cluster.aurora.master_user_secret[0].secret_arn
}

output "database_name" {
  description = "Default database name created on the cluster."
  value       = aws_rds_cluster.aurora.database_name
}
