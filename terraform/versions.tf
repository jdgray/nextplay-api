terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # >= 5.40 for `manage_master_user_password` on aws_rds_cluster (RDS-managed
      # Secrets Manager credentials) and Aurora Serverless v2 scaling config.
      version = ">= 5.40, < 6.0.0"
    }
  }

  # State is local by default. Before more than one person applies this,
  # switch to a remote backend, e.g.:
  #
  # backend "s3" {
  #   bucket         = "nextplay-terraform-state"
  #   key            = "postgres/terraform.tfstate"
  #   region         = "us-west-2"
  #   dynamodb_table = "nextplay-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
