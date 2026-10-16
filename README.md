# OpsDesk — DevSecOps capstone

OpsDesk is a small operations work-item dashboard. A user can create incidents, search and filter the queue, move incidents through a simple lifecycle, and inspect summary counts. The Helm directory keeps its original `taskboard` path because it is the course chart location; the application, images, namespace, database, and release names use OpsDesk terminology.

This repository demonstrates the configuration and runbooks for a DevSecOps capstone:

- React 18 + Vite frontend served by Nginx
- FastAPI backend with SQLAlchemy, Pydantic, and Alembic
- PostgreSQL for the Compose and Helm paths
- Pytest API tests
- Docker Compose for local development
- GitHub Actions, Docker image builds, and Trivy scanning
- Terraform definitions for an AWS VPC and EKS cluster
- Kubernetes manifests and a Helm chart
- ArgoCD Application template for an optional GitOps path
- Prometheus/Grafana monitoring values and a dashboard artifact
- Deliberately broken Kubernetes manifests for troubleshooting practice

The repository contains repeatable configuration and documentation. It does **not** claim that AWS, a Kubernetes cluster, ArgoCD, Prometheus, Grafana, or a successful hosted CI run is currently live. Capture actual runtime evidence using [demo/evidence-checklist.md](demo/evidence-checklist.md).

## Contents

- [Architecture](#architecture)
- [Repository map](#repository-map)
- [OpsDesk behavior](#opsdesk-behavior)
- [Local setup](#local-setup)
- [API](#api)
- [Testing](#testing)
- [CI/CD and supply chain](#cicd-and-supply-chain)
- [Terraform](#terraform)
- [Kubernetes and Helm](#kubernetes-and-helm)
- [ArgoCD](#argocd)
- [Prometheus and Grafana](#prometheus-and-grafana)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Demo materials and evidence](#demo-materials-and-evidence)

## Architecture

### Local Compose path

```text
Browser :3000
    │
    ▼
Frontend container: Nginx + React static files
    │ /api/* and /health
    ▼
Backend container: FastAPI :8000
    │
    ▼
PostgreSQL container :5432
```

The frontend uses the relative `/api` path. Nginx proxies that path to the Compose service named `backend`; the browser does not need the internal database or backend hostname.

### Intended cluster and observability path

```text
User
  │
  ▼
Ingress ──► frontend Service ──► React/Nginx
  │                              │ /api/*
  └────────► backend Service ◄───┘
                    │
                    ├──► PostgreSQL Deployment + PVC
                    ├──► /health and /ready probes
                    └──► /metrics
                              │ ServiceMonitor
                              ▼
                       Prometheus ──► Grafana
```

Terraform describes the AWS VPC/EKS foundation. Helm describes the application resources. ArgoCD can reconcile the Helm chart from Git after its repository, image, tag, and database-secret values have been supplied.

## Repository map

```text
backend/                    FastAPI app, SQLAlchemy models, migrations, tests
frontend/                   React/Vite UI and Nginx configuration
docker-compose.yml          Local PostgreSQL + backend + frontend stack
terraform/                  AWS VPC and EKS Terraform modules
k8s/                        Kubernetes namespace bootstrap manifest
helm/taskboard/             Helm chart with app, Postgres, HPA, Ingress, ServiceMonitor
monitoring/                 Prometheus values and importable Grafana dashboard
argocd/application.yaml     Configured ArgoCD Application for the live project deployment
troubleshooting/            Broken image and broken Service exercises
scripts/                    Load-test helper
demo/                       Deck source, presenter walkthrough, evidence checklist
.github/workflows/ci-cd.yml Active GitHub Actions workflow
```

## OpsDesk behavior

- The Overview screen loads incidents and statistics from `/api/incidents` and `/api/incidents/stats`.
- A new incident starts in `OPEN` and can be advanced to `IN_PROGRESS` and `RESOLVED`; a resolved incident can be reopened.
- Status values are `OPEN`, `IN_PROGRESS`, and `RESOLVED`.
- Priority values are `LOW`, `MEDIUM`, and `HIGH`.
- Empty, filtered, loading, and API-error states are rendered by the frontend.
- The API validates non-blank titles and rejects invalid status/priority values.

## Local setup

### Prerequisites

- Docker Desktop or Docker Engine with the Compose plugin
- For the direct development path: Python 3.12+, PostgreSQL, and Node.js/npm
- For infrastructure work: Terraform 1.7+, AWS CLI, and an AWS account with permission to create VPC/EKS resources
- For cluster work: `kubectl`, Helm, Kind for local validation, and access to a disposable Kubernetes cluster
- For security/GitOps checks: Trivy and the ArgoCD CLI

### Recommended path: Docker Compose

From the repository root:

```bash
docker compose up --build
```

Open:

```text
Frontend: http://localhost:3000
API docs: http://localhost:8000/docs
Health:   http://localhost:8000/health
Ready:    http://localhost:8000/ready
Metrics:  http://localhost:8000/metrics
```

If port `3000` is already in use, start Compose with `FRONTEND_PORT=3001 docker compose up --build` and use `http://localhost:3001` instead.

Compose creates:

| Service | Image/build | Port | Purpose |
|---|---|---:|---|
| `postgres` | `postgres:16-alpine` | `5432` | `opsdesk` database |
| `backend` | `./backend` | `8000` | FastAPI and metrics |
| `frontend` | `./frontend` | `3000 → 8080` | React UI and non-root Nginx proxy |

The Compose file supplies `DATABASE_URL=postgresql+psycopg://opsdesk:opsdesk@postgres:5432/opsdesk`. PostgreSQL and backend health checks gate startup so migrations run only after the database accepts connections. Stop the stack with:

```bash
docker compose down
```

Remove the local database volume as well when a clean reset is needed:

```bash
docker compose down -v
```

The backend image runs `alembic upgrade head` before Uvicorn. A fresh database may take a few seconds before `/ready` succeeds.

### Direct backend development

The application default and `backend/.env.example` use an `opsdesk` database. Set a reachable PostgreSQL URL explicitly if the database uses different credentials:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://opsdesk:opsdesk@localhost:5432/opsdesk'
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
curl -sS http://localhost:8000/health
curl -sS http://localhost:8000/ready
curl -sS http://localhost:8000/api/incidents
```

### Frontend-only development

The Vite app expects the API at the relative `/api` path, which is configured for the built Nginx container. For the complete user flow, use Compose. The frontend build check is:

```bash
cd frontend
npm ci
npm run build
```

## API

The canonical resource is `incidents`. FastAPI Swagger is available at `/docs` and the OpenAPI schema is at `/openapi.json` when the backend is running.

### Operational endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Service name, version, and docs link |
| `GET` | `/health` | Liveness response: `{"status":"UP"}` |
| `GET` | `/ready` | Database-backed readiness response; returns `503` if the DB query fails |
| `GET` | `/metrics` | Prometheus text exposition from `prometheus-fastapi-instrumentator` |

### Incident endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/incidents` | List incidents, newest first |
| `GET` | `/api/incidents/{id}` | Fetch one incident; `404` when missing |
| `POST` | `/api/incidents` | Create an incident; returns `201` |
| `PUT` | `/api/incidents/{id}` | Update one or more fields |
| `DELETE` | `/api/incidents/{id}` | Delete an incident; returns `204` |
| `GET` | `/api/incidents/stats` | Return total/open/in-progress/resolved counts |

The hidden compatibility aliases `/api/work-items`, `/api/work-items/{id}`, `/api/work-items/stats` and their POST/PUT/DELETE variants map to the same handlers. The older `/api/tasks` names are not current API routes.

Example request:

```bash
curl -sS -X POST http://localhost:8000/api/incidents \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Checkout API returning 500s",
    "description": "Error rate increased after a release.",
    "priority": "HIGH",
    "assignee": "on-call"
  }'
```

Use the returned `id` for a read, update, or delete:

```bash
curl -sS http://localhost:8000/api/incidents/1
curl -sS -X PUT http://localhost:8000/api/incidents/1 \
  -H 'Content-Type: application/json' \
  -d '{"status":"IN_PROGRESS"}'
curl -i -X DELETE http://localhost:8000/api/incidents/1
```

## Testing

Backend tests use an in-memory SQLite engine through a dependency override; they do not use the Compose/PostgreSQL database:

```bash
cd backend
pytest -q
```

The suite covers health/root, readiness/metrics, CRUD, statistics, validation boundaries, and not-found behavior. The frontend package also runs `node --test` against pure filtering and display-formatting behavior in `frontend/test/utils.test.js`.

## CI/CD and supply chain

`.github/workflows/ci-cd.yml` is the only GitHub Actions workflow. It triggers on pushes and pull requests targeting `main` and performs:

1. Install Python dependencies and run `pytest -q`.
2. Install Node dependencies with `npm ci` and build the frontend.
3. Build backend and frontend images with lowercase GHCR owner names.
4. Scan both local images with Trivy for HIGH and CRITICAL vulnerabilities.
5. Fail the build when Trivy reports a matching vulnerability.
6. On pushes, publish only commit-SHA image tags to GHCR.
7. On pushes, publish the commit-SHA image tags to GHCR. A manual `workflow_dispatch` with the `deploy` input enabled optionally deploys them with Helm using the `KUBE_CONFIG_DATA` repository secret.

The workflow requires no Docker Hub credentials. GHCR publishing uses the built-in `GITHUB_TOKEN`. The deploy job requires a reachable cluster, a base64-encoded kubeconfig in `KUBE_CONFIG_DATA`, an ingress controller, Metrics Server, Prometheus Operator CRDs, and the `opsdesk-postgres` Secret. If GHCR packages are private, set the `GHCR_PULL_SECRET_NAME` repository variable to the pre-created Kubernetes pull-Secret name.

## Terraform

`terraform/` uses the `terraform-aws-modules/vpc/aws` and `terraform-aws-modules/eks/aws` modules. Defaults are:

| Setting | Value |
|---|---|
| AWS region | `ap-south-1` |
| Cluster | `opsdesk-eks` |
| VPC CIDR | `10.20.0.0/16` |
| Availability zones | `ap-south-1a`, `ap-south-1b` |
| Subnets | two public and two private `/24` ranges |
| NAT | one NAT gateway |
| Nodes | managed `t3.small` by default, min 2 / desired 4 / max 4 |
| Kubernetes version | `1.31` in the module input |

Review and validate before applying:

```bash
cd terraform
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan
terraform apply
aws eks update-kubeconfig --region ap-south-1 --name opsdesk-eks
```

The EKS configuration also manages the AWS EBS CSI add-on and grants its node role the AWS-managed EBS CSI policy. Apply [k8s/storageclass-gp3.yaml](k8s/storageclass-gp3.yaml) after the add-on is ready so PostgreSQL can bind its PVC.

Destroy classroom infrastructure when finished:

```bash
terraform destroy
```

EKS and a NAT gateway can incur AWS charges. AWS credentials are intentionally not stored in this repository. The Terraform files describe infrastructure; this repository contains no live AWS plan, apply, console, or destroy evidence.

## Kubernetes and Helm

### Bootstrap manifest

The `k8s/namespace.yaml` file creates the `opsdesk` namespace. Helm is the single source of truth for the application Deployments, Services, PostgreSQL, Ingress, HPA, and ServiceMonitor.

### Helm chart

The chart at `helm/taskboard` includes:

- frontend and backend Deployments and ClusterIP Services
- PostgreSQL Deployment, external Secret reference, Service, and 5 GiB PVC
- backend readiness (`/ready`) and liveness (`/health`) probes
- configurable resource requests/limits
- optional Nginx Ingress
- optional backend CPU HPA, 2–6 replicas by default
- backend ServiceMonitor for `/metrics`

Inspect before a cluster install:

```bash
helm lint ./helm/taskboard
helm template opsdesk ./helm/taskboard \
  --namespace opsdesk \
  --set backend.image=example.invalid/opsdesk-backend \
  --set frontend.image=example.invalid/opsdesk-frontend \
  --set backend.tag=demo \
  --set frontend.tag=demo
```

The default chart values contain placeholder image names. A real install must set image repositories and tags that the cluster can pull:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/storageclass-gp3.yaml
kubectl -n opsdesk create secret generic opsdesk-postgres \
  --from-literal=database-url='postgresql+psycopg://opsdesk:opsdesk@opsdesk-postgres:5432/opsdesk' \
  --from-literal=username='opsdesk' \
  --from-literal=password='replace-for-your-cluster'
helm upgrade --install opsdesk ./helm/taskboard \
  --namespace opsdesk \
  --create-namespace \
  --set backend.image=ghcr.io/REPLACE_WITH_OWNER/opsdesk-backend \
  --set frontend.image=ghcr.io/REPLACE_WITH_OWNER/opsdesk-frontend \
  --set backend.tag=REPLACE_WITH_COMMIT_SHA \
  --set frontend.tag=REPLACE_WITH_COMMIT_SHA
```

For a development values render:

```bash
helm upgrade --install opsdesk ./helm/taskboard \
  --namespace opsdesk \
  --create-namespace \
  --values helm/taskboard/values-dev.yaml \
  --set backend.image=example.invalid/opsdesk-backend \
  --set frontend.image=example.invalid/opsdesk-frontend \
  --set backend.tag=demo \
  --set frontend.tag=demo
```

`values-dev.yaml` enables the `opsdesk.local` Ingress and disables HPA. `values-prod.yaml` enables the example host `opsdesk.example.com`, the `gp3` PostgreSQL StorageClass, and HPA but still requires real image values, DNS, an Ingress controller, and a pre-created database Secret. HPA also requires Metrics Server or another resource metrics provider. PostgreSQL sets `PGDATA` below the mounted volume root so the EBS `lost+found` directory does not prevent first initialization.

## ArgoCD

`argocd/application.yaml` is the configured project Application. It tracks `main`, renders `helm/taskboard`, uses `values-prod.yaml`, targets the in-cluster API server and `opsdesk` namespace, and enables automated prune/self-heal with `CreateNamespace=true`. The current live classroom deployment uses immutable ECR tag `live-20261017-r2` for the frontend and `live-20261017` for the backend. Update those parameters for each new image release.

With ArgoCD installed in a cluster:

```bash
kubectl apply -f argocd/application.yaml
argocd app get opsdesk
argocd app diff opsdesk
argocd app sync opsdesk
argocd app wait opsdesk --health --timeout 180
```

Use the ArgoCD UI or CLI output as evidence only after seeing the actual Application state. ArgoCD will not fix invalid image references, missing registry pull access, or a missing `opsdesk-postgres` Secret automatically.

## Prometheus and Grafana

The backend instruments FastAPI and exposes Prometheus text at `/metrics`. The Helm chart's `ServiceMonitor` selects the backend Service, uses port `http`, scrapes `/metrics`, and requests a 15-second interval.

Install the Prometheus community stack with the repository values:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/prometheus-values.yaml
```

`monitoring/prometheus-values.yaml`:

- enables Grafana;
- enables the Grafana dashboard sidecar for ConfigMaps labeled `grafana_dashboard=1`;
- lets Prometheus discover ServiceMonitors across namespaces;
- sets 15-second scrape/evaluation intervals and seven-day retention.

After a compatible application release exists:

```bash
kubectl get servicemonitor -A
kubectl get endpoints -n opsdesk opsdesk-backend
kubectl port-forward -n opsdesk svc/opsdesk-backend 8000:8000
curl -sS http://127.0.0.1:8000/metrics | head -n 20
```

Port-forward the UIs:

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

Import [monitoring/opsdesk-dashboard.json](monitoring/opsdesk-dashboard.json) in Grafana, select the Prometheus datasource, and generate a few API requests. The dashboard includes:

- HTTP request rate
- 5xx error rate
- p95 request latency
- request rate by status
- p95 latency by handler
- backend scrape status
- current request mix

The dashboard filters on Prometheus Operator `namespace="opsdesk"` and `service="opsdesk-backend"` labels. If a compatible installation uses different labels, inspect `http_requests_total` in Prometheus and adjust the dashboard filters during import. A populated dashboard and an `UP` target are runtime evidence that must be captured separately.

More focused monitoring commands are in [monitoring/README.md](monitoring/README.md).

## Troubleshooting

### Local Compose

```bash
docker compose ps
docker compose logs backend
docker compose logs postgres
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
```

If `/ready` returns `503`, check the Postgres container, the Compose `DATABASE_URL`, and migration logs. If the UI loads but the queue errors, check the browser network panel and backend logs for `/api/incidents`.

### Kubernetes basics

```bash
kubectl get pods -n opsdesk
kubectl get svc,endpoints -n opsdesk
kubectl describe pod -n opsdesk <pod-name>
kubectl get events -n opsdesk --sort-by=.lastTimestamp
kubectl logs -n opsdesk deploy/opsdesk-backend
```

For `ImagePullBackOff`, inspect the rendered image repository/tag, registry credentials, and Pod events. For a Service with no endpoints, compare its selector with `kubectl get pods --show-labels -n opsdesk`.

### Provided failure exercises

Broken image:

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n opsdesk
kubectl describe pod -n opsdesk -l app=broken-image
kubectl get events -n opsdesk --sort-by=.lastTimestamp
kubectl delete -f troubleshooting/broken-image.yaml
```

Broken Service selector:

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get svc,endpoints -n opsdesk broken-service
kubectl get pods --show-labels -n opsdesk
kubectl delete -f troubleshooting/broken-service.yaml
```

### Prometheus/Grafana

1. Confirm the backend endpoint itself returns text from `/metrics`.
2. Confirm the Service has endpoints and the ServiceMonitor selector matches the backend Service labels.
3. Confirm `kubectl get servicemonitor -A` and Prometheus **Status → Targets**.
4. Query `http_requests_total` without dashboard filters before debugging PromQL.
5. Generate traffic with `curl` and refresh the dashboard time range.

The existing `scripts/load-test.sh` defaults to the incident list endpoint. Use a reachable host or override it explicitly, for example:

```bash
URL=http://localhost:8000/api/incidents ./scripts/load-test.sh
```

### ArgoCD

```bash
argocd app get opsdesk
argocd app diff opsdesk
kubectl get application -n argocd opsdesk -o yaml
```

Inspect the rendered Helm manifests and Application conditions for invalid repository URLs, image placeholders, namespace access, or chart render errors.

## Known limitations

These are current repository facts and should be explained during a demo:

1. **Hosted CI evidence is environment-dependent.** The repository workflow is valid and ready for a GitHub run, but this workspace cannot inspect GitHub Actions because the `gh` CLI is not installed. GHCR publishing can run with the built-in token, while Helm deployment requires `KUBE_CONFIG_DATA`, registry pull access, an ingress controller, Metrics Server, Prometheus Operator CRDs, and the external `opsdesk-postgres` Secret.
3. **The Helm database is classroom-grade.** PostgreSQL runs in-cluster with a PVC. There is no managed RDS integration, backup policy, TLS, rotation, or high-availability database design.
4. **Security hardening is incomplete.** There is no application authentication/authorization, network policy, production secret manager, or least-privilege review for the complete cluster path. CORS is permissive in the backend.
5. **The ArgoCD image tag is release-specific.** The Application is live and synced for the classroom ECR tag recorded above; update the tag when publishing a new image.
6. **Dashboard labels depend on the scrape shape.** `monitoring/opsdesk-dashboard.json` assumes the standard Prometheus Operator `namespace` and `service` labels. Confirm them in Prometheus before treating panels as valid.
7. **Frontend test scope is intentionally small.** The package now covers pure filtering and display formatting with `node --test`; React browser interaction remains a manual/runtime check.

## Demo materials and evidence

- [demo/presentation.md](demo/presentation.md) — title slide plus 11 content-slide source covering the app, architecture, CI/CD, Terraform, Kubernetes/Helm, ArgoCD, observability, and limitations.
- [demo/presentation.pptx](demo/presentation.pptx) — generated PowerPoint deck with a title slide plus 11 content slides.
- [demo/video-script.md](demo/video-script.md) — complete ordered recording script for the mandatory walkthrough video.
- [demo/walkthrough.md](demo/walkthrough.md) — presenter script with exact commands and evidence language.
- [demo/evidence-checklist.md](demo/evidence-checklist.md) — checklist that distinguishes captured, pending, and unavailable evidence.
- [monitoring/opsdesk-dashboard.json](monitoring/opsdesk-dashboard.json) — importable Grafana dashboard.
- [argocd/application.yaml](argocd/application.yaml) — configured ArgoCD Application for the project deployment.

The PowerPoint deck is generated from the Markdown source and validated as an OOXML archive. The mandatory walkthrough video still must be recorded separately after live CI, infrastructure, Kubernetes, ArgoCD, Prometheus, and Grafana evidence has been captured.

For the complete ordered demo flow, start with `demo/presentation.md`, then follow `demo/walkthrough.md`, and finish by marking every row in `demo/evidence-checklist.md` honestly.
