variable "aws_region" {
  description = "AWS region in which the VPC and EKS cluster are provisioned."
  type        = string
  default     = "ap-south-1"

  validation {
    condition     = var.aws_region == "ap-south-1"
    error_message = "This project is pinned to its selected Region, ap-south-1. Update the availability zones and review costs before choosing another Region."
  }
}

variable "cluster_name" {
  description = "Name of the EKS cluster."
  type        = string
  default     = "opsdesk-eks"
}

variable "environment" {
  description = "Environment label applied to provisioned resources."
  type        = string
  default     = "dev"
}

variable "node_instance_type" {
  description = "EC2 instance type for the EKS managed node group. t3.small is suitable for the current free-tier classroom account."
  type        = string
  default     = "t3.small"
}
