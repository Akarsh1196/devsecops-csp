# OpsDesk presentation and walkthrough script

This is a concise command reference for the full recording. Use [video-script.md](video-script.md) for the complete narration and exact presentation order. This file is not an assertion that the commands have been run. Use the exact command output and screenshots captured during the session as evidence. If a dependency or cluster is unavailable, say so and mark the item accordingly.

## 0. Ground rules

- Present `demo/presentation.md` first.
- Do not describe an AWS account, Kubernetes cluster, ArgoCD sync, Prometheus target, or Grafana panel as live unless it is visible during the recording.
- Use a disposable namespace/cluster for experiments and remove broken lab resources afterward.
- Keep credentials and kubeconfigs out of the recording and repository.

## 1. Introduce the repository

Say:

> OpsDesk is the incident/work-item product. The repository contains an active GHCR and Helm workflow plus an optional ArgoCD GitOps path. Live AWS and cluster state must be demonstrated separately.

Show:

```bash
git status --short
find . -maxdepth 2 -type d | sort
```

Point to `backend/`, `frontend/`, `docker-compose.yml`, `terraform/`, `helm/taskboard/`, `k8s/`, `monitoring/`, `argocd/`, and `demo/`.

## 2. Run the local stack

```bash
docker compose up --build
```

Show the browser at `http://localhost:3000`, create one incident, advance its status, and refresh. In a second terminal:

```bash
curl -sS http://localhost:8000/health
curl -sS http://localhost:8000/ready
curl -sS http://localhost:8000/api/incidents
curl -sS http://localhost:8000/metrics | head -n 20
```

Open `http://localhost:8000/docs` and demonstrate one POST, one PUT, one GET, and one DELETE. Capture the UI, API docs, and metrics output.

When finished:

```bash
docker compose down
```

## 3. Show tests and the active CI path

Run the repository-local backend test command from the correct directory:

```bash
cd backend
pytest -q
cd ..
```

Open `.github/workflows/ci-cd.yml` in the GitHub UI and explain the actual sequence: tests, frontend build, Docker builds, Trivy gates, GHCR SHA-tagged publishing, then optional Helm deployment on `main` when `KUBE_CONFIG_DATA` is configured.

If a GitHub run is available, show its URL and status. Otherwise mark CI evidence as not captured.

## 4. Show Terraform without inventing AWS state

```bash
cd terraform
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan
cd ..
```

Explain the VPC, private/public subnets, NAT gateway, EKS cluster, and managed node group. Show AWS Console or `aws eks` output only if this session actually has access to the provisioned account. Otherwise say: **“The repository contains the Terraform definition; no live AWS evidence is available in this recording.”**

## 5. Render and inspect the Helm chart

```bash
helm lint ./helm/taskboard
helm template opsdesk ./helm/taskboard --namespace opsdesk \
  --set backend.image=example.invalid/opsdesk-backend \
  --set frontend.image=example.invalid/opsdesk-frontend \
  --set backend.tag=demo --set frontend.tag=demo
```

Show the rendered `ServiceMonitor`, HPA, Ingress, Services, and Deployments. Confirm that the rendered service names, frontend port `8080`, backend port `8000`, and `opsdesk` namespace agree before presenting this as a live traffic path.

## 6. Demonstrate the ArgoCD manifest as a GitOps design

Open `argocd/application.yaml` and explain the placeholders. Before a real cluster demo, replace:

- `repoURL`
- both `REPLACE_WITH_OWNER` image values
- both `REPLACE_WITH_COMMIT_SHA` tag values

On a cluster with ArgoCD installed, use:

```bash
kubectl apply -f argocd/application.yaml
argocd app get opsdesk
argocd app diff opsdesk
argocd app sync opsdesk
argocd app wait opsdesk --health --timeout 180
```

Show the ArgoCD UI and CLI output only after those commands succeed. The expected story is Git commit → Application render → Helm resources → health/sync state.

## 7. Install and inspect monitoring

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml
kubectl get servicemonitor -A
kubectl get pods -n monitoring
```

After a compatible OpsDesk Helm release exists:

```bash
kubectl port-forward -n opsdesk svc/opsdesk-backend 8000:8000
curl -sS http://127.0.0.1:8000/metrics | head -n 20
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

Show Prometheus **Status → Targets** and filter for the OpsDesk backend. In Grafana, import or provision `monitoring/opsdesk-dashboard.json`, select Prometheus, generate a few API requests, and show populated request-rate/latency panels. If the target is down or labels differ, stop and troubleshoot rather than presenting an empty panel as evidence.

## 8. Run one failure drill

Use the intentionally broken manifests only in a disposable namespace:

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n opsdesk
kubectl describe pod -n opsdesk -l app=broken-image
kubectl get events -n opsdesk --sort-by=.lastTimestamp
kubectl delete -f troubleshooting/broken-image.yaml
```

Then explain the Service selector exercise:

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get svc,endpoints -n opsdesk broken-service
kubectl delete -f troubleshooting/broken-service.yaml
```

Expected lessons are `ImagePullBackOff` for a missing image and no Endpoints for a selector that matches no Pods.

## 9. Close with evidence status

Open `demo/evidence-checklist.md`. For every row, state whether the evidence is **captured**, **not available**, or **not applicable**. Do not replace a missing screenshot with a claim.
