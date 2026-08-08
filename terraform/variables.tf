variable "aws_region" {
  description = "AWS region to deploy into (matches serverless.yml's default)."
  type        = string
  default     = "us-west-2"
}

variable "stage" {
  description = "Deployment stage, used in resource naming (matches serverless.yml's $${sls:stage})."
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Short name used as a prefix for all resources."
  type        = string
  default     = "nextplay"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC the Aurora cluster lives in."
  type        = string
  default     = "10.42.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the private subnets backing the DB subnet group. Aurora requires at least 2, in different AZs."
  type        = list(string)
  default     = ["10.42.1.0/24", "10.42.2.0/24"]
}

variable "db_name" {
  description = "Default database created on the cluster (matches docker-compose's POSTGRES_DB)."
  type        = string
  default     = "nextplay"
}

variable "master_username" {
  description = "Master username for the cluster (matches docker-compose's POSTGRES_USER)."
  type        = string
  default     = "nextplay"
}

variable "engine_version" {
  description = "Aurora PostgreSQL engine version. Must be one that supports Serverless v2 - check with: aws rds describe-db-engine-versions --engine aurora-postgresql --query \"DBEngineVersions[?SupportsServerless==true].EngineVersion\""
  type        = string
  default     = "16.9"
}

variable "min_capacity" {
  description = "Minimum Aurora Serverless v2 capacity in ACUs."
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum Aurora Serverless v2 capacity in ACUs."
  type        = number
  default     = 4
}

variable "deletion_protection" {
  description = "Whether to enable deletion protection on the cluster. Leave false for dev, set true for prod."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Whether to skip the final snapshot on cluster deletion. Leave true for dev, set false for prod."
  type        = bool
  default     = true
}
