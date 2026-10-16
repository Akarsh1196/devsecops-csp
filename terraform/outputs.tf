output "cluster_name" {
  description = "Name of the EKS cluster."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "API endpoint of the EKS cluster."
  value       = module.eks.cluster_endpoint
}

output "vpc_id" {
  description = "ID of the VPC hosting the EKS cluster."
  value       = module.vpc.vpc_id
}
