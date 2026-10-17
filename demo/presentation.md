---
title: "OpsDesk: from code to observable operations"
subtitle: "DevSecOps capstone"
author: "OpsDesk platform team"
date: "17 October 2026"
---

<!-- Source note: this deck summarizes the implemented OpsDesk platform and the live classroom deployment verified on 17 October 2026. -->

---

## Slide 1 — Platform at a glance

**DevSecOps capstone**

- Incident/work-item dashboard for an operations team
- React + FastAPI + PostgreSQL
- CI/CD, containers, Terraform, Kubernetes, Helm, ArgoCD, Prometheus, and Grafana artifacts
- Delivery path verified from local Compose through a live EKS deployment

**Technology stack**

- **Frontend:** React 18, Vite, Node.js 22, Nginx
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Pydantic, Alembic, Pytest
- **Platform:** Docker Compose, GitHub Actions, Trivy, Terraform, AWS EKS, Kubernetes, Helm, ArgoCD, Prometheus, Grafana

**Presenter note:** The repository is named `devsecops-csp`; the product presented by the current frontend and API is OpsDesk.

---

## Slide 2 — The application outcome

- Create incidents with title, description, priority, status, and owner
- Filter the queue by status, priority, or text
- Advance work through `OPEN → IN_PROGRESS → RESOLVED`
- Read summary statistics from the API
- Use `/health`, `/ready`, and `/metrics` for operational checks

**Verified outcome:** the live Ingress served the React application, and the API smoke flow created incident `1`, moved it to `IN_PROGRESS`, and returned updated statistics.

---

## Slide 3 — Architecture

```text
Browser
  │  local port 3001 or AWS NGINX Ingress /
  ▼
React static site + Nginx
  │  /api/*
  ▼
FastAPI / OpsDesk API ───────► PostgreSQL
  │ /metrics
  ▼
Prometheus ◄── ServiceMonitor ── Kubernetes Service
  │
  ▼
Grafana dashboard
```

- Docker Compose is the local three-service path; it was verified with PostgreSQL, backend, and frontend containers.
- Helm packages the cluster path and includes PostgreSQL/PVC, HPA, Ingress, and ServiceMonitor resources.
- Terraform manages the AWS VPC, EKS cluster, managed nodes, EBS CSI add-on, and supporting IAM.

---

## Slide 4 — API and data flow

Canonical API resources:

```text
GET    /api/incidents
GET    /api/incidents/{id}
POST   /api/incidents
PUT    /api/incidents/{id}
DELETE /api/incidents/{id}
GET    /api/incidents/stats
```

- Alembic migrations manage the database schema.
- Pydantic validates titles, statuses, priorities, and update payloads.
- `/api/work-items` remains as a hidden compatibility alias.

**Verified API flow:** `/health` returned `UP`, `/ready` returned `READY`, the live CRUD smoke test succeeded, and Prometheus scraped both backend Pods.

---

## Slide 5 — Local developer workflow

```bash
FRONTEND_PORT=3001 docker compose up --build -d
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:3001/
docker compose down
```

- Compose starts Postgres, the FastAPI backend, and Nginx-served frontend.
- The Compose database uses the development `opsdesk` database/user/password values in `docker-compose.yml`.
- The backend container runs Alembic migrations before serving traffic.
- The local smoke check completed successfully; the frontend was mapped to port `3001` because port `3000` was already in use.

---

## Slide 6 — CI/CD and supply-chain controls

**Active workflow:** `.github/workflows/ci-cd.yml`

1. Runs on pushes and pull requests targeting `main`
2. Backend Pytest, frontend tests, and frontend production build
3. Terraform format/validation and Helm lint/render validation
4. Builds backend/frontend images
5. Trivy HIGH/CRITICAL scan with `exit-code: 1`
6. Pushes commit-SHA-tagged images to GHCR
7. Optional manual deployment with `workflow_dispatch`, prerequisite checks, and Helm

**Verified locally:** `actionlint` passed, frontend tests reported `3 passed`,
backend tests reported `9 passed`, and the local cached-DB Trivy scans reported
zero HIGH/CRITICAL findings for both images.

---

## Slide 7 — Terraform foundation

```text
AWS VPC 10.20.0.0/16
  ├── two public subnets
  ├── two private subnets
  ├── single NAT gateway
  └── EKS opsdesk-eks
         └── managed t3.small node group, desired size 4
```

```text
Initial plan:   non-empty → apply succeeded
Steady-state:   No changes
Cluster:        opsdesk-eks / ACTIVE / Kubernetes 1.31
Region:         ap-south-1
Workers:        4 x t3.small / Ready
Storage:        AWS EBS CSI + default gp3 StorageClass
```

**Observed live evidence:** the initial provisioning plan was non-empty and applied successfully; the steady-state refresh later reported `No changes`. The `opsdesk-eks` cluster is ACTIVE in `ap-south-1` with four Ready `t3.small` nodes and the AWS EBS CSI add-on.

---

## Slide 8 — Kubernetes and Helm

- `k8s/` contains the namespace and `gp3` StorageClass bootstrap manifests; Helm owns the application resources.
- `helm/taskboard` packages frontend, backend, PostgreSQL/PVC, Ingress, HPA, and ServiceMonitor.
- Production deployment is running with 2 backend Pods, 2 frontend Pods, 1 PostgreSQL Pod, a Bound 5 GiB PVC, and an AWS load balancer.
- Backend and frontend are exposed internally through ClusterIP Services; the NGINX Ingress routes `/` to frontend and `/api` to backend.
- `helm upgrade --install` completed successfully and all application Pods reached `Running`.
- The PostgreSQL chart sets `PGDATA` below the mounted volume root so a fresh EBS filesystem can initialize correctly.

```bash
helm lint ./helm/taskboard
helm template opsdesk ./helm/taskboard -n opsdesk
```

**Verified:** Helm lint and production rendering passed.

---

## Slide 9 — ArgoCD GitOps path

`argocd/application.yaml` is the configured project Application:

```text
Git main branch
      │
      ▼
ArgoCD Application
      │ renders helm/taskboard
       ▼
opsdesk namespace
```

- The current live release points at the project repository and immutable ECR image tags.
- `automated.prune` and `selfHeal` are enabled in the Application manifest.
- The live Application was observed as `Synced` and `Healthy` after deployment.

**Observed live evidence:** `kubectl -n argocd get application opsdesk` reported `Healthy Synced`. The Application tracks `Akarsh1196/devsecops-csp` and reconciles the `main` branch into the `opsdesk` namespace.

---

## Slide 10 — Prometheus and Grafana

- FastAPI instrumentation exposes Prometheus metrics at `/metrics`.
- The Helm ServiceMonitor scrapes the backend every 15 seconds.
- `monitoring/prometheus-values.yaml` enables Grafana and cross-namespace ServiceMonitor discovery.
- `monitoring/opsdesk-dashboard.json` includes request rate, 5xx rate, p95 latency, status mix, and scrape health panels.
- The dashboard is provisioned as `OpsDesk API Overview` with Grafana UID `opsdesk-api-overview`.

```bash
kubectl get servicemonitor -A
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

**Observed live evidence:** Prometheus returned `up{namespace="opsdesk",service="opsdesk-backend"}=1` for both backend Pods, and request-rate series were present for health, readiness, metrics, list, create, update, and stats endpoints.

---

## Slide 11 — Failure drills, limitations, and close

Failure drills:

- Broken image → `ImagePullBackOff` → inspect Pod/events and image tag
- Broken selector → empty Endpoints → compare Service selector with Pod labels
- Empty dashboard → inspect target health, metric names, and scrape labels

Key learnings:

- Infrastructure as Code creates the foundation; GitOps continuously reconciles application state.
- Readiness probes express dependency health, while liveness probes protect process health.
- Immutable image tags plus scan gates make each release traceable and safer to promote.
- Service selectors, ServiceMonitor labels, and PromQL queries are the first checkpoints when debugging an empty dashboard.

Known limitations:

- No authentication, authorization, production secret management, or managed RDS integration
- Hosted GitHub Actions evidence still requires a user-run workflow; the live classroom deployment uses ECR because GHCR packages are private.
- PostgreSQL remains classroom-grade in-cluster storage without backup/HA or managed RDS.

**Close:** OpsDesk is implemented, containerized, scanned, deployed to EKS, synchronized by ArgoCD, and observable through Prometheus/Grafana. The only remaining submission artifact is the separately recorded walkthrough video.
