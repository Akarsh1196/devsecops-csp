# Submission Guidelines — DevSecOps Capstone Project

## Deadline

| | |
|---|---|
| **Date** | Sunday, 19 October 2026 |
| **Time** | 11:59 PM IST |

Late submissions lose **5 points per 24-hour period** after the deadline.

---

## What to Submit

Submit a single GitHub repository link via the submission form. The repo must contain:

1. **`README.md`** — complete technical documentation (setup, architecture, stack, CI/CD, Terraform, K8s, observability)
2. **`demo/` folder** with:
   - 🎥 **Presentation video** (MP4) — **MANDATORY**
   - 📊 **PPT / PDF slide deck** — **MANDATORY**
3. **`Submission Link:`**: https://forms.gle/XWAP1vAumDJgAPM1A

The repository now includes the following demo sources and runbooks:

- [`demo/presentation.md`](./demo/presentation.md) — title slide plus 11-slide deck source
- [`demo/video-script.md`](./demo/video-script.md) — complete recording script with narration, commands, and evidence markers
- [`demo/walkthrough.md`](./demo/walkthrough.md) — ordered presenter script
- [`demo/evidence-checklist.md`](./demo/evidence-checklist.md) — evidence status checklist
- [`monitoring/opsdesk-dashboard.json`](./monitoring/opsdesk-dashboard.json) — importable Grafana dashboard
- [`argocd/application.yaml`](./argocd/application.yaml) — ArgoCD Application template

The repository includes the generated [`demo/presentation.pptx`](./demo/presentation.pptx). Record the MP4 separately before submitting; the source and deck do not represent live AWS/cluster evidence.

---

## Video Requirements

Your video must cover (in this order):

1. Present your PPT slides — what you built, architecture overview
2. Live walkthrough of:
   - **Codebase** — folder structure, key files
   - **CI/CD** — trigger a push, show GitHub Actions pipeline running end-to-end
   - **Terraform** — `terraform plan` output, AWS Console (VPC + EKS)
   - **ArgoCD** — synced application, GitOps flow
   - **Kubernetes** — `kubectl get pods`, services, ingress all healthy
   - **Prometheus** — Targets page showing app as `UP`
   - **Grafana** — live dashboard with application metrics

> **No video = 0 points for M10**, regardless of other submitted artifacts.

Use the active workflow in [README.md](./README.md) when presenting CI/CD: `.github/workflows/ci-cd.yml` is the only active workflow, publishing SHA-tagged images to GHCR and deploying with Helm when `KUBE_CONFIG_DATA` is configured. Show AWS, Kubernetes, ArgoCD, Prometheus, and Grafana states only when they are actually available during the recording.

---

See [GRADING.md](./GRADING.md) for the full rubric and per-module requirements.
