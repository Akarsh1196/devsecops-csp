variable "aws_region" {
  description = "AWS region in which the VPC and EKS cluster are provisioned."
  type        = string
  default     = "ap-south-1"
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
