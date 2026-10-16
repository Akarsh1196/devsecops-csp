# OpsDesk runtime evidence

This report records non-video checks that were actually run in the workspace and
the live AWS/EKS project. It intentionally contains no credentials, passwords,
tokens, or private payloads.

## Repository and local application

| Result | Check | Observation |
|---|---|---|
| PASS | Backend tests | `.venv/bin/pytest -q` — 9 passed, one existing Starlette deprecation warning. |
| PASS | Frontend tests | `npm test` in `frontend/` — 3 passed. |
| PASS | Frontend build | `npm run build` — Vite production build completed. |
| PASS | Docker Compose | `FRONTEND_PORT=3001 docker compose up --build -d` started PostgreSQL, backend, and frontend; health, readiness, metrics, and UI requests returned successfully. |
| PASS | Container security scan | Trivy HIGH/CRITICAL scan with the locally cached database reported zero findings for backend and frontend images. A normal DB refresh was blocked by a mirror timeout; the cached-DB result is the one recorded here. |
| PASS | Failure drill: broken image | `troubleshooting/broken-image.yaml` produced `ImagePullBackOff`, then the deployment was deleted. |
| PASS | Failure drill: broken Service | `troubleshooting/broken-service.yaml` produced an empty Endpoints object, then the Service was deleted. |

The initial system Python interpreter did not have the backend test dependency
installed. The project virtual environment was used for the valid test result.

## Infrastructure and EKS

| Result | Check | Observation |
|---|---|---|
| PASS | Terraform format/validation | `terraform fmt -check -recursive` and `terraform validate` passed. |
| PASS | Terraform plan | With AWS CLI credentials exported for profile `opsdesk`, Terraform reported `No changes` after refresh. |
| PASS | EKS cluster | `opsdesk-eks` is ACTIVE in `ap-south-1`, Kubernetes 1.31. |
| PASS | Worker nodes | Four `t3.small` nodes were Ready after increasing capacity for the monitoring and ArgoCD workloads. |
| PASS | EBS storage | AWS EBS CSI managed add-on is installed; `gp3` is the default StorageClass; the PostgreSQL 5 GiB PVC is Bound. |
| PASS | Ingress | NGINX Ingress controller is installed and the OpsDesk Ingress received an AWS load balancer hostname. |
| PASS | Metrics | Metrics Server is installed and the Metrics API returned samples for all nodes. |

The project is using the `opsdesk` AWS profile in the selected Region. The
current identity is the AWS root identity, which should be replaced with a
least-privilege team-member identity for routine or production work.

## Live OpsDesk deployment

The live application is managed by ArgoCD and uses project ECR images because
the GHCR packages were not anonymously pullable from the cluster:

```text
Backend:  992163310601.dkr.ecr.ap-south-1.amazonaws.com/opsdesk-backend:live-20261017
Frontend: 992163310601.dkr.ecr.ap-south-1.amazonaws.com/opsdesk-frontend:live-20261017-r2
```

Observed Kubernetes state:

- ArgoCD Application `opsdesk`: `Healthy`, `Synced`.
- Backend: 2/2 Ready.
- Frontend: 2/2 Ready.
- PostgreSQL: 1/1 Ready.
- HPA, Ingress, ServiceMonitor, and the PostgreSQL PVC exist.
- The Prometheus Operator ServiceMonitor was created successfully.

The EBS-backed PostgreSQL deployment required `PGDATA=/var/lib/postgresql/data/pgdata`
because a freshly mounted filesystem contains `lost+found` at its root. That
setting is now in the Helm template; the current live Deployment was patched
with the same setting while the repository changes await the user's push.

## Live API checks

Requests were sent through the NGINX load balancer using the configured host
header `opsdesk.example.com`:

```text
GET  /health          -> {"status":"UP"}
GET  /ready           -> {"status":"READY"}
GET  /api/incidents   -> [] before the smoke create
POST /api/incidents   -> incident id 1 created
PUT  /api/incidents/1 -> status changed to IN_PROGRESS
GET  /api/incidents/stats -> {"total":1,"open":0,"inProgress":1,"resolved":0}
```

## Observability

The dashboard ConfigMap `opsdesk-dashboard` was created in the `monitoring`
namespace with the `grafana_dashboard=1` sidecar label.

Prometheus was queried through a temporary port-forward. The query
`up{namespace="opsdesk",service="opsdesk-backend"}` returned two backend
series, both with value `1`. The request-rate query also returned `/health`,
`/ready`, `/metrics`, `/api/incidents`, and `/api/incidents/{incident_id}`
series with successful traffic.

Grafana was queried through a temporary port-forward using the in-cluster
admin Secret without printing its value. The Grafana API returned the imported
dashboard `OpsDesk API Overview` with UID `opsdesk-api-overview`.

## CI/CD status

The workflow was linted locally with `actionlint` and passed. The workflow now
has separate backend/frontend tests, Terraform/Helm validation, image build and
Trivy jobs, and an explicitly enabled manual deployment input. A hosted GitHub
Actions run and GHCR package visibility were not verified in this workspace
because the `gh` CLI is not installed and the packages were not anonymously
pullable. The live deployment therefore uses ECR, while the repository workflow
continues to publish GHCR images for GitHub-hosted runs.

## Reproduction commands

From the repository root:

```bash
cd backend && ../backend/.venv/bin/pytest -q
cd ../frontend && npm test && npm run build
cd ..
terraform -chdir=terraform fmt -check -recursive
terraform -chdir=terraform validate
helm lint ./helm/taskboard
kubectl -n argocd get application opsdesk
kubectl -n opsdesk get pods,svc,ingress,hpa,pvc,servicemonitor
```

Video recording and screenshots are intentionally outside this report.
