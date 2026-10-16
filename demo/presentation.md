# OpsDesk DevSecOps capstone — presentation deck source

This Markdown file is the source for the generated `presentation.pptx` deck: a title slide plus 11 content slides. Regenerate it with Pandoc when the source changes, then record the walkthrough separately. Every runtime claim in the slides is phrased as an intended check; replace the evidence placeholders with screenshots or links only after running the commands in `demo/evidence-checklist.md`.

---

## Slide 1 — OpsDesk: from code to observable operations

**DevSecOps capstone**

- Incident/work-item dashboard for an operations team
- React + FastAPI + PostgreSQL
- CI/CD, containers, Terraform, Kubernetes, Helm, ArgoCD, Prometheus, and Grafana artifacts

**Presenter note:** The repository is named `devsecops-csp`; the product presented by the current frontend and API is OpsDesk.

---

## Slide 2 — The application outcome

- Create incidents with title, description, priority, status, and owner
- Filter the queue by status, priority, or text
- Advance work through `OPEN → IN_PROGRESS → RESOLVED`
- Read summary statistics from the API
- Use `/health`, `/ready`, and `/metrics` for operational checks

**Evidence placeholder:** browser capture of the running OpsDesk UI.

---

## Slide 3 — Architecture

```text
Browser
  │  http://localhost:3000 or Ingress /
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

- Docker Compose is the local three-service path.
- Helm packages the cluster path and includes PostgreSQL, HPA, Ingress, and ServiceMonitor templates.
- Terraform describes the AWS VPC and EKS foundation.

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

**Evidence placeholder:** `/docs`, a CRUD request, and `curl /metrics` output.

---

## Slide 5 — Local developer workflow

```bash
docker compose up --build
open http://localhost:3000
open http://localhost:8000/docs
docker compose down
```

- Compose starts Postgres, the FastAPI backend, and Nginx-served frontend.
- The Compose database uses the `opsdesk` database/user/password values in `docker-compose.yml`.
- The direct backend path uses an explicitly supplied `DATABASE_URL` and Alembic.

---

## Slide 6 — CI/CD and supply-chain controls

**Active workflow:** `.github/workflows/ci-cd.yml`

1. Pytest and frontend build
2. Build backend/frontend images
3. Trivy HIGH/CRITICAL scan with `exit-code: 1`
4. Push SHA-tagged images to GHCR
5. On `main`, optionally deploy the SHA-tagged images with Helm using `KUBE_CONFIG_DATA`

---

## Slide 7 — Terraform foundation

```text
AWS VPC 10.20.0.0/16
  ├── two public subnets
  ├── two private subnets
  ├── single NAT gateway
  └── EKS opsdesk-eks
        └── managed t3.medium node group, desired size 2
```

```bash
cd terraform
terraform init
terraform validate
terraform plan
terraform apply
aws eks update-kubeconfig --region ap-south-1 --name opsdesk-eks
```

**Evidence placeholder:** plan/AWS Console capture, only if actually provisioned. No live AWS evidence is included in this repository.

---

## Slide 8 — Kubernetes and Helm

- `k8s/` contains the namespace bootstrap manifest; Helm owns the application resources.
- `helm/taskboard` packages frontend, backend, PostgreSQL/PVC, optional Ingress, HPA, and ServiceMonitor.
- `values-dev.yaml` enables `opsdesk.local` Ingress and disables HPA.
- `values-prod.yaml` enables Ingress/HPA but still needs real image names, a real host, and the external database Secret.

```bash
helm lint ./helm/taskboard
helm template opsdesk ./helm/taskboard -n opsdesk
```

---

## Slide 9 — ArgoCD GitOps path

`argocd/application.yaml` is a reviewable Application template:

```text
Git main branch
      │
      ▼
ArgoCD Application
      │ renders helm/taskboard
       ▼
opsdesk namespace
```

- Replace repository, owner, and image/tag placeholders before applying.
- `automated.prune` and `selfHeal` are enabled in the template.
- The manifest is not proof that ArgoCD is installed or synced.

**Evidence placeholder:** `argocd app get opsdesk` showing Synced/Healthy after a real deployment.

---

## Slide 10 — Prometheus and Grafana

- FastAPI instrumentation exposes Prometheus metrics at `/metrics`.
- The Helm ServiceMonitor scrapes the backend every 15 seconds.
- `monitoring/prometheus-values.yaml` enables Grafana and cross-namespace ServiceMonitor discovery.
- `monitoring/opsdesk-dashboard.json` includes request rate, 5xx rate, p95 latency, status mix, and scrape health panels.

```bash
kubectl get servicemonitor -A
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

**Evidence placeholder:** Prometheus target `UP` and populated Grafana panels after generating traffic.

---

## Slide 11 — Failure drills, limitations, and close

Failure drills:

- Broken image → `ImagePullBackOff` → inspect Pod/events and image tag
- Broken selector → empty Endpoints → compare Service selector with Pod labels
- Empty dashboard → inspect target health, metric names, and scrape labels

Known limitations:

- No authentication, authorization, production secret management, or managed RDS integration
- GHCR publishing, Helm deployment, and ArgoCD synchronization require external credentials and cluster access
- No live AWS, Kubernetes, ArgoCD, Prometheus, or Grafana evidence is claimed here

**Close:** use the evidence checklist to turn each intended check into a captured result.
