# OpsDesk evidence checklist

Use the status column during the demo. `CAPTURED` means the result was observed and saved at the referenced path or URL; `PENDING` means the check still needs to be run; `NOT AVAILABLE` is an honest result when no local service, cluster, AWS account, or hosted CI run is available.

## Repository and application

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| PENDING | Repository structure | `git status --short`; inspect allowed directories | terminal screenshot |
| PENDING | OpsDesk UI | `docker compose up --build`; open `http://localhost:3000` | browser screenshot |
| PENDING | CRUD API | Open `http://localhost:8000/docs`; run create/read/update/delete | API response capture |
| PENDING | Health/readiness | `curl http://localhost:8000/health` and `/ready` | terminal screenshot |
| PENDING | Metrics format | `curl http://localhost:8000/metrics` | terminal screenshot |
| PENDING | Tests | `(cd backend && pytest -q)` | terminal output |

## CI/CD and security

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| PENDING | Active workflow | Open `.github/workflows/ci-cd.yml`; show a real GitHub run if available | run URL/screenshot |
| PENDING | Frontend build | `npm ci && npm run build` in `frontend/`, or workflow log | terminal/workflow log |
| PENDING | Image build | workflow Docker build logs | workflow log |
| PENDING | Trivy gate | workflow Trivy logs for both images | workflow log |
| PENDING | Registry result | Verify pushed GHCR images and SHA tag, if a workflow run exists | registry URL |

## Terraform and cluster

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| PENDING | Terraform formatting | `(cd terraform && terraform fmt -check -recursive)` | terminal output |
| PENDING | Terraform validation | `(cd terraform && terraform init && terraform validate)` | terminal output |
| PENDING | Terraform plan | `(cd terraform && terraform plan)` | plan output |
| NOT AVAILABLE | Live AWS VPC/EKS | Only mark captured after viewing the target AWS account/cluster | AWS URL/screenshot |
| PENDING | Namespace bootstrap | `kubectl apply -f k8s/namespace.yaml` | terminal output |
| PENDING | Helm render | `helm lint ./helm/taskboard` and `helm template ...` | terminal output |
| NOT AVAILABLE | Live Pods/Ingress | Only mark captured after running `kubectl get pods,svc,ingress -n opsdesk` | terminal screenshot |

## ArgoCD and observability

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| NOT AVAILABLE | ArgoCD sync | `argocd app get opsdesk` after installing/customizing the Application | CLI/UI screenshot |
| PENDING | Monitoring install | `helm upgrade --install kube-prometheus-stack ... -f monitoring/prometheus-values.yaml` | terminal output |
| PENDING | ServiceMonitor | `kubectl get servicemonitor -A` | terminal screenshot |
| NOT AVAILABLE | Prometheus target UP | Prometheus **Status → Targets** for the backend | Prometheus screenshot |
| PENDING | Dashboard artifact | Import `monitoring/opsdesk-dashboard.json` and select Prometheus | Grafana import screenshot |
| NOT AVAILABLE | Populated live panels | Show request rate/latency after generating traffic | Grafana screenshot |

## Failure drills

| Status | Evidence | Exact check | Capture |
|---|---|---|---|
| PENDING | Broken image | Apply `troubleshooting/broken-image.yaml`; inspect Pod/events; delete it | terminal screenshot |
| PENDING | Broken Service | Apply `troubleshooting/broken-service.yaml`; inspect `svc,endpoints`; delete it | terminal screenshot |
| PENDING | Monitoring diagnosis | Explain target, `/metrics`, labels, and dashboard query checks | presenter notes |

## Submission gate

- [x] Generate and validate `demo/presentation.pptx` from `demo/presentation.md`.
- [x] Save the ordered recording script at `demo/video-script.md`.
- [ ] Replace every `PENDING` row with `CAPTURED`, `NOT AVAILABLE`, or a follow-up owner/date.
- [ ] Do not add AWS, cluster, ArgoCD, Prometheus, Grafana, or CI links that were not actually observed.
- [ ] Record the final video separately; this repository contains the presentation source and walkthrough script, not a recorded MP4.
