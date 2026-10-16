# OpsDesk evidence checklist

Use the status column during the demo. `CAPTURED` means the result was observed and saved at the referenced path or URL; `PENDING` means the check still needs to be run; `NOT AVAILABLE` is an honest result when no local service, cluster, AWS account, or hosted CI run is available.

## Repository and application

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| CAPTURED | Repository structure | `git status --short`; inspect allowed directories | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | OpsDesk UI | `FRONTEND_PORT=3001 docker compose up --build -d`; request `http://localhost:3001/` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | CRUD API | Run live create/update/stats requests through the EKS Ingress | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Health/readiness | Request `/health` and `/ready` through the EKS Ingress | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Metrics format | Request local `/metrics` and query Prometheus backend series | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Tests | `(cd backend && .venv/bin/pytest -q)` and `frontend/npm test` | [runtime evidence](../reports/runtime-evidence.md) |

## CI/CD and security

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| CAPTURED | Active workflow | `actionlint .github/workflows/ci-cd.yml` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Frontend build | `npm ci && npm run build` in `frontend/` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Image build | Built and pushed platform-compatible ECR images for the live deployment | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Trivy gate | Cached-DB HIGH/CRITICAL scans reported zero findings for both local images | [runtime evidence](../reports/runtime-evidence.md) |
| NOT AVAILABLE | Hosted registry result | GHCR package visibility and a hosted Actions run require the user's GitHub session | [runtime evidence](../reports/runtime-evidence.md) |

## Terraform and cluster

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| CAPTURED | Terraform formatting | `(cd terraform && terraform fmt -check -recursive)` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Terraform validation | `(cd terraform && terraform init && terraform validate)` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Terraform plan | Credential-exported plan reported `No changes` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Live AWS VPC/EKS | `opsdesk-eks` ACTIVE with four Ready nodes in `ap-south-1` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Namespace bootstrap | `kubectl apply -f k8s/namespace.yaml` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Helm render | `helm lint ./helm/taskboard` and production `helm template` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Live Pods/Ingress | `kubectl get pods,svc,ingress -n opsdesk` | [runtime evidence](../reports/runtime-evidence.md) |

## ArgoCD and observability

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| CAPTURED | ArgoCD sync | `opsdesk` Application observed `Healthy` and `Synced` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Monitoring install | `kube-prometheus-stack` installed with project values | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | ServiceMonitor | `kubectl get servicemonitor -A` shows `opsdesk-backend` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Prometheus target UP | Prometheus API returned two backend `up=1` series | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Dashboard artifact | `opsdesk-dashboard` ConfigMap loaded with `grafana_dashboard=1` | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Populated live panels | Grafana API found `OpsDesk API Overview`; Prometheus returned live request-rate series after traffic generation | [runtime evidence](../reports/runtime-evidence.md) |

## Failure drills

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| CAPTURED | Broken image | Applied manifest, observed `ImagePullBackOff`, deleted it | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Broken Service | Applied manifest, observed empty Endpoints, deleted it | [runtime evidence](../reports/runtime-evidence.md) |
| CAPTURED | Monitoring diagnosis | Verified ServiceMonitor labels, `/metrics`, Prometheus `up`, and request-rate queries | [runtime evidence](../reports/runtime-evidence.md) |

## Submission gate

- [x] Generate and validate `demo/presentation.pptx` from `demo/presentation.md`.
- [x] Save the ordered recording script at `demo/video-script.md`.
- [x] Replace every `PENDING` row with `CAPTURED`, `NOT AVAILABLE`, or a follow-up owner/date.
- [ ] Do not add AWS, cluster, ArgoCD, Prometheus, Grafana, or CI links that were not actually observed.
- [ ] Record the final video separately; this repository contains the presentation source and walkthrough script, not a recorded MP4.
