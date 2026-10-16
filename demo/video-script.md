# OpsDesk capstone video recording script

This is the script for the mandatory final presentation video. Follow the order exactly: present the deck first, then show the live implementation and operational evidence. The script is written so that AWS, Kubernetes, ArgoCD, Prometheus, Grafana, and GitHub Actions claims are made only when they are visible during the recording.

## Recording rules

- Start with `demo/presentation.pptx`.
- Keep the terminal font large enough to read.
- Do not show AWS access keys, secret values, kubeconfig contents, GitHub tokens, or private repository secrets.
- Replace every `[CAPTURE]` marker with an actual screenshot or live screen during recording.
- If a live service is unavailable, say **“This is configured in the repository but is not live in this recording”**. Do not invent evidence.
- Use the final commit SHA in all CI, registry, Helm, and ArgoCD demonstrations.
- Keep the browser, terminal, GitHub Actions, AWS Console, ArgoCD, Prometheus, and Grafana windows ready before recording.

## Suggested duration

| Chapter | Content | Target |
|---|---|---:|
| 1 | Presentation slides | 2–3 min |
| 2 | Codebase and local application | 2–3 min |
| 3 | Tests, CI/CD, GHCR, and Trivy | 2–3 min |
| 4 | Terraform and AWS | 2 min |
| 5 | ArgoCD GitOps | 1–2 min |
| 6 | Kubernetes and Helm | 2 min |
| 7 | Prometheus | 1 min |
| 8 | Grafana and HPA | 1–2 min |
| 9 | Troubleshooting, cleanup, and close | 1 min |

---

## Chapter 1 — Present the PowerPoint first

**Open:** `demo/presentation.pptx`

### Opening

Say:

> This is OpsDesk, an incident and work-item management platform built as a DevSecOps capstone. I will first present the architecture and design, then demonstrate the application, automated delivery, infrastructure, Kubernetes deployment, GitOps, and observability.

### Slide 1 — Product overview

Say:

> OpsDesk helps an operations team create, prioritize, assign, and resolve incidents. The product uses React and Vite in the browser, FastAPI for the API, PostgreSQL for persistence, and a full DevSecOps delivery path around the application.

### Slide 2 — User outcome

Say:

> Users can create incidents with a title, description, priority, and owner. Incidents move through the lifecycle open, in progress, and resolved. The dashboard supports search, status filtering, priority filtering, summary counts, loading states, empty states, and backend error handling.

### Slide 3 — Architecture

Say:

> In the local path, the browser reaches the Nginx-served React frontend. Nginx proxies API requests to FastAPI, and FastAPI stores incidents in PostgreSQL. In the cluster path, Helm deploys the frontend, backend, and PostgreSQL resources. Prometheus scrapes the backend metrics through a ServiceMonitor, and Grafana displays the operational data.

### Slide 4 — API and data flow

Say:

> The backend provides health, readiness, metrics, incident list, single-incident, create, update, delete, and statistics endpoints. Alembic owns schema migrations, SQLAlchemy owns persistence, and Pydantic validates request boundaries.

### Slide 5 — Local workflow

Say:

> Docker Compose starts the complete local stack with one command. PostgreSQL has a health check, the backend waits for PostgreSQL and runs migrations, and the frontend runs as an unprivileged Nginx container.

### Slide 6 — CI/CD and security

Say:

> The active workflow runs backend tests and the frontend build before building images. It scans both images with Trivy and fails on high or critical vulnerabilities. Successful pushes publish immutable commit-SHA tags to GHCR. A configured main-branch deploy can then install the Helm release.

### Slide 7 — Terraform

Say:

> Terraform describes the AWS foundation: a VPC, public and private subnets, a NAT gateway, an EKS control plane, and a managed node group. The AWS account and plan output will be shown later only if they are available during the recording.

### Slide 8 — Kubernetes and Helm

Say:

> The namespace manifest is only the bootstrap. Helm owns the application resources: frontend and backend Deployments, ClusterIP Services, PostgreSQL and its PVC, Ingress, HPA, and ServiceMonitor. The production values use two frontend and two backend replicas.

### Slide 9 — ArgoCD

Say:

> ArgoCD provides the GitOps path. It watches the repository, renders the Helm chart, and reconciles the desired state into the OpsDesk namespace. The committed Application file is a template until repository, image, and tag placeholders are replaced.

### Slide 10 — Prometheus and Grafana

Say:

> FastAPI exposes Prometheus-formatted metrics. The ServiceMonitor scrapes the backend every 15 seconds, and the dashboard includes request rate, error rate, latency, status mix, and scrape health panels.

### Slide 11 — Failure drills and limitations

Say:

> The project includes deliberate broken image and broken Service exercises. The main limitations are that this classroom deployment has no application authentication, no managed RDS integration, and no production secret manager. I will show only runtime evidence that is actually available.

**Slide transition:** Move from the presentation to the live repository walkthrough.

---

## Chapter 2 — Codebase and local application

### Repository overview

Show the repository in the terminal or editor.

Run:

```bash
git status --short
printf '\nTop-level directories:\n'
find . -maxdepth 2 -type d | sort
```

Say:

> The repository is organized by delivery responsibility. `backend` contains the FastAPI application, migrations, and tests. `frontend` contains the React application and Nginx runtime. Docker Compose provides the local stack. Terraform describes AWS, Helm describes Kubernetes, monitoring contains Prometheus and Grafana artifacts, ArgoCD contains the GitOps Application, and demo contains the presentation and evidence runbooks.

Point to these files:

```text
backend/app/main.py
backend/app/models.py
backend/app/schemas.py
backend/alembic/versions/
backend/tests/test_api.py
frontend/src/main.jsx
docker-compose.yml
.github/workflows/ci-cd.yml
terraform/
helm/taskboard/
monitoring/
argocd/application.yaml
```

### Start the local stack

Run from the repository root:

```bash
docker compose up --build -d
docker compose ps
```

If port 3000 is busy:

```bash
FRONTEND_PORT=3001 docker compose up --build -d
```

Open the frontend URL in the browser.

**Say:**

> The application is now running through the same container boundaries used in the local demonstration. I will create an incident in the UI, move it through the lifecycle, and then verify the same data through the API.

In the browser:

1. Show the OpsDesk dashboard.
2. Click **New incident**.
3. Enter a realistic incident, for example:
   - Title: `Checkout API returning 500 errors`
   - Description: `Error rate increased after the latest release.`
   - Priority: `High`
   - Owner: `on-call`
4. Create it.
5. Show the incident in the queue and the updated KPI cards.
6. Click **Start work**.
7. Click **Resolve**.
8. Demonstrate status or priority filtering.

**[CAPTURE]** Browser screenshot showing the populated OpsDesk dashboard.

### Verify health, readiness, metrics, and API

In another terminal, run:

```bash
curl -sS http://localhost:8000/health
curl -sS http://localhost:8000/ready
curl -sS http://localhost:8000/api/incidents
curl -sS http://localhost:8000/api/incidents/stats
curl -sS http://localhost:8000/metrics | head -n 20
```

Say:

> `/health` proves that the process is alive. `/ready` proves that the database query succeeds. `/metrics` exposes Prometheus text, and the incident endpoints show the persisted application data.

**[CAPTURE]** Terminal output for health, readiness, incident data, and metrics.

Open:

```text
http://localhost:8000/docs
```

Show the Swagger page and demonstrate one create, one read, one update, and one delete operation. Use a temporary test incident and delete it afterward.

When the local demonstration is complete:

```bash
docker compose down
```

If the database may contain only demo data and should be reset:

```bash
docker compose down -v
```

---

## Chapter 3 — Tests, CI/CD, GHCR, and Trivy

### Run the local quality gate

Run:

```bash
cd backend
pytest -v
cd ..

cd frontend
npm ci
npm run build
cd ..
```

Say:

> The backend suite uses an isolated in-memory SQLite database rather than the production PostgreSQL database. It covers health, readiness, metrics, CRUD, statistics, validation, and not-found behavior. The frontend build confirms that the production bundle can be generated.

**[CAPTURE]** Passing Pytest output and frontend build output.

### Explain the workflow

Open:

```text
.github/workflows/ci-cd.yml
```

Say:

> The workflow is deliberately ordered as a quality gate. Tests and the frontend build run first. The image job runs only after they pass. Both images are then scanned with Trivy. On a push, the images are published to GHCR with the exact commit SHA, so an image can be traced back to source.

### Trigger and show a real run

After the final changes have been committed and pushed by the repository owner:

```bash
git rev-parse HEAD
git push origin main
```

Open the GitHub Actions run and show:

1. Test job passing.
2. Frontend build passing.
3. Backend image build.
4. Frontend image build.
5. Trivy backend scan.
6. Trivy frontend scan.
7. GHCR publish.
8. Helm deploy, if `KUBE_CONFIG_DATA` is configured.

Say:

> This run proves the delivery path for this commit. A green run means the configured checks passed; it does not replace runtime proof from AWS, Kubernetes, Prometheus, or Grafana.

**[CAPTURE]** GitHub Actions run URL and green job summary.

### Show GHCR and Trivy evidence

Open the GHCR package pages and show both image names and the commit-SHA tag:

```text
ghcr.io/<owner>/opsdesk-backend:<commit-sha>
ghcr.io/<owner>/opsdesk-frontend:<commit-sha>
```

Open the Trivy logs and say:

> Trivy scans the final container images for high and critical vulnerabilities. The workflow uses a non-zero exit code for matching findings, so the security scan is a gate rather than an informational message.

**[CAPTURE]** GHCR package pages and Trivy scan output.

---

## Chapter 4 — Terraform and AWS

### Validate Terraform locally

Run:

```bash
cd terraform
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan -out=opsdesk.tfplan
cd ..
```

Say:

> Terraform is the infrastructure-as-code layer. The plan describes the VPC, two public subnets, two private subnets, a NAT gateway, an EKS cluster, and a managed worker node group. I will not show or claim AWS runtime evidence unless the plan and AWS Console are available in this recording.

**[CAPTURE]** Terraform plan output with no credentials visible.

### Show AWS Console evidence

If AWS is configured and the apply has completed:

1. Open the AWS Console in the correct region, `ap-south-1`.
2. Show the VPC and its public/private subnets.
3. Show the NAT gateway.
4. Show the EKS cluster named `opsdesk-eks`.
5. Show the managed node group and its healthy nodes.

Say:

> This is the live AWS evidence corresponding to the Terraform configuration. The infrastructure is not just described in code; these resources are visible in the target account and region.

If AWS is not ready, say:

> Terraform configuration and validation are complete, but AWS runtime evidence is not available in this recording. I am not presenting the configuration as proof that infrastructure exists.

After the EKS cluster is ready, configure kubectl without showing the kubeconfig contents:

```bash
aws eks update-kubeconfig --region ap-south-1 --name opsdesk-eks --profile opsdesk
kubectl cluster-info
```

**[CAPTURE]** AWS Console VPC/EKS views or an honest unavailable-evidence statement.

---

## Chapter 5 — ArgoCD GitOps

### Prepare the Application template

Before recording this section, replace only the placeholders in a working copy or finalized committed manifest:

```text
REPLACE_WITH_OWNER
REPLACE_WITH_REPOSITORY
REPLACE_WITH_COMMIT_SHA
```

Never put credentials in the manifest.

Open:

```text
argocd/application.yaml
```

Say:

> This Application watches the main branch, renders the OpsDesk Helm chart, targets the OpsDesk namespace, and enables automated prune and self-healing. The image tags are pinned to a commit SHA rather than a mutable latest tag.

Apply and inspect it only if ArgoCD is installed:

```bash
kubectl apply -f argocd/application.yaml
argocd app get opsdesk
argocd app diff opsdesk
argocd app sync opsdesk
argocd app wait opsdesk --health --timeout 180
```

Show the ArgoCD UI or CLI with:

```text
Sync status: Synced
Health status: Healthy
```

Say:

> The GitOps flow is now visible: the Git commit is the desired state, ArgoCD renders Helm, and Kubernetes contains the reconciled resources.

If ArgoCD is not installed, say:

> The ArgoCD Application template is committed and validated, but a live ArgoCD synchronization is not available in this recording.

**[CAPTURE]** ArgoCD Application showing Synced and Healthy, or honest unavailable evidence.

---

## Chapter 6 — Kubernetes and Helm

### Show Helm validation

Run:

```bash
helm lint ./helm/taskboard
helm template opsdesk ./helm/taskboard \
  --namespace opsdesk \
  --values ./helm/taskboard/values-prod.yaml \
  --set-string backend.image=ghcr.io/<owner>/opsdesk-backend \
  --set-string frontend.image=ghcr.io/<owner>/opsdesk-frontend \
  --set-string backend.tag=<commit-sha> \
  --set-string frontend.tag=<commit-sha>
```

Say:

> Helm renders release-scoped OpsDesk names and keeps the backend, frontend, PostgreSQL, Ingress, HPA, and ServiceMonitor configuration consistent. The production values use two frontend and two backend replicas.

### Deploy and inspect the release

If using the EKS cluster or another disposable cluster:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl get namespace opsdesk
helm upgrade --install opsdesk ./helm/taskboard \
  --namespace opsdesk \
  --create-namespace \
  --values ./helm/taskboard/values-prod.yaml \
  --set-string backend.image=ghcr.io/<owner>/opsdesk-backend \
  --set-string frontend.image=ghcr.io/<owner>/opsdesk-frontend \
  --set-string backend.tag=<commit-sha> \
  --set-string frontend.tag=<commit-sha> \
  --wait --timeout 10m
```

Show:

```bash
kubectl get pods -n opsdesk
kubectl get svc -n opsdesk
kubectl get ingress -n opsdesk
kubectl get hpa -n opsdesk
helm list -n opsdesk
```

Say:

> The Pods are managed by Deployments, Services provide stable networking, the Ingress routes `/` to the frontend and `/api` to the backend, and the HPA has resource requests available for CPU-based scaling.

**[CAPTURE]** Running Pods, Services, Ingress, HPA, and Helm release.

Open the application through the actual Ingress host and create one incident.

**[CAPTURE]** Browser showing OpsDesk through Ingress.

---

## Chapter 7 — Prometheus

### Install or show the monitoring stack

If Prometheus Operator is not already installed:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/prometheus-values.yaml
```

Show the target configuration:

```bash
kubectl get servicemonitor -A
kubectl get endpoints -n opsdesk opsdesk-backend
kubectl port-forward -n opsdesk svc/opsdesk-backend 8000:8000
```

In another terminal:

```bash
curl -sS http://127.0.0.1:8000/metrics | head -n 20
```

Open Prometheus:

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
```

Open **Status → Targets** and show the OpsDesk backend target as `UP`.

Say:

> The backend exposes metrics, the ServiceMonitor selects the backend Service, and Prometheus reports the scrape target as healthy. This connects application instrumentation to the monitoring system.

**[CAPTURE]** `/metrics` output, ServiceMonitor, and Prometheus target marked `UP`.

---

## Chapter 8 — Grafana and HPA

### Show Grafana

Port-forward Grafana:

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

Open Grafana and import or provision:

```text
monitoring/opsdesk-dashboard.json
```

Generate traffic from a terminal:

```bash
for i in $(seq 1 100); do
  curl -fsS http://<opsdesk-host>/api/incidents >/dev/null
done
```

Show populated panels for:

- Request rate.
- 5xx error rate.
- p95 latency.
- Request status mix.
- Backend scrape health.

Say:

> Grafana is visualizing the same metrics collected by Prometheus. The dashboard turns raw request and latency measurements into an operational view that can be used during an incident.

**[CAPTURE]** Grafana dashboard with populated panels.

### Show HPA

Run:

```bash
kubectl get hpa -n opsdesk
kubectl describe hpa -n opsdesk opsdesk-backend
```

Say:

> The HPA uses CPU utilization and resource requests to decide whether the backend should scale within its configured minimum and maximum replica range. A normal request may not create enough load to scale; the important evidence is that the HPA is configured and metrics are available.

---

## Chapter 9 — Failure drill, cleanup, and close

### Broken image exercise

Run only in a disposable namespace or cluster:

```bash
kubectl apply -f troubleshooting/broken-image.yaml
kubectl get pods -n opsdesk
kubectl describe pod -n opsdesk -l app=broken-image
kubectl get events -n opsdesk --sort-by=.lastTimestamp
kubectl delete -f troubleshooting/broken-image.yaml
```

Say:

> The deliberately invalid image produces an image-pull failure. I use Pod description and events to identify the image and tag problem, then remove the exercise resource.

### Broken Service selector exercise

```bash
kubectl apply -f troubleshooting/broken-service.yaml
kubectl get svc,endpoints -n opsdesk broken-service
kubectl get pods --show-labels -n opsdesk
kubectl delete -f troubleshooting/broken-service.yaml
```

Say:

> The Service has no endpoints because its selector does not match any Pod labels. This demonstrates why a Service can exist while traffic still fails.

### Final evidence checklist

Open:

```text
demo/evidence-checklist.md
```

Say:

> I am marking each item as captured, unavailable, or pending based on what was actually observed. The repository contains the implementation and reproducible runbooks; the video provides the live evidence for the infrastructure and observability items that were available during this session.

### Cleanup

For a classroom EKS environment:

```bash
helm uninstall opsdesk --namespace opsdesk
helm uninstall kube-prometheus-stack --namespace monitoring
kubectl delete namespace opsdesk monitoring
cd terraform
terraform destroy
```

Do not run destructive cleanup until all screenshots and evidence have been saved.

Close by saying:

> OpsDesk demonstrates the complete path from application code to testing, container security, registry publishing, infrastructure as code, Kubernetes delivery, GitOps, autoscaling, monitoring, and troubleshooting. The final submission includes the source, the PowerPoint deck, this recording script, and the evidence checklist.
