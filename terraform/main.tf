locals {
  name = "${var.project_name}-${var.stage}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

# --- Networking -------------------------------------------------------
# VPC with private-only subnets across 2 AZs (the minimum Aurora's DB subnet
# group requires). No IGW/NAT: Lambdas deployed into this VPC (see
# serverless.yml's `provider.vpc`) reach CloudWatch Logs and Cognito via the
# PrivateLink endpoints below instead of general internet egress. Add another
# interface endpoint (or a NAT Gateway) if a future handler needs to reach
# some other AWS service or the public internet from inside the VPC.

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = local.name
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${local.name}-private-${count.index}"
  }
}

resource "aws_db_subnet_group" "aurora" {
  name       = "${local.name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name}-db-subnet-group"
  }
}

# --- Security group -----------------------------------------------------
# Allows Postgres from anything else in this VPC. Once the Lambda security
# group (currently commented out in serverless.yml) exists, prefer scoping
# this to that SG's ID instead of the whole VPC CIDR.

resource "aws_security_group" "aurora" {
  name        = "${local.name}-aurora-sg"
  description = "Allow Postgres access to the ${local.name} Aurora cluster"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "Postgres from within the VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name}-aurora-sg"
  }
}

# --- VPC interface endpoints ---------------------------------------------
# This VPC has no NAT/IGW, so Lambdas deployed into it (see serverless.yml's
# `provider.vpc`) would otherwise have no route to anything outside the VPC -
# including CloudWatch Logs (every invocation needs this just to log) and the
# Cognito IDP API (called directly by the auth handlers). PrivateLink
# endpoints cover exactly those two without opening general internet egress.

resource "aws_security_group" "vpc_endpoints" {
  name        = "${local.name}-vpc-endpoints-sg"
  description = "Allow HTTPS to VPC interface endpoints from within the VPC"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTPS from within the VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name}-vpc-endpoints-sg"
  }
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name}-logs-endpoint"
  }
}

resource "aws_vpc_endpoint" "cognito_idp" {
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.aws_region}.cognito-idp"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${local.name}-cognito-idp-endpoint"
  }
}

# --- Aurora Serverless v2 (PostgreSQL) -----------------------------------
# Auth is master username/password via RDS-managed Secrets Manager
# credentials (`manage_master_user_password`), not IAM database auth - IAM
# auth tokens expire every 15 minutes and Prisma's DATABASE_URL has no way to
# refresh one. This matches the RDS Proxy comment in serverless.yml, which
# expects `AuthScheme: SECRETS` pointed at this same secret.

resource "aws_rds_cluster" "aurora" {
  cluster_identifier = "${local.name}-cluster"

  engine         = "aurora-postgresql"
  engine_mode    = "provisioned"
  engine_version = var.engine_version

  database_name   = var.db_name
  master_username = var.master_username

  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.name}-final-snapshot"

  tags = {
    Name = "${local.name}-cluster"
  }
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "${local.name}-writer"
  cluster_identifier = aws_rds_cluster.aurora.id

  engine         = aws_rds_cluster.aurora.engine
  engine_version = aws_rds_cluster.aurora.engine_version
  instance_class = "db.serverless"

  db_subnet_group_name = aws_db_subnet_group.aurora.name

  tags = {
    Name = "${local.name}-writer"
  }
}
