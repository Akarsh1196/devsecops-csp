# OpsDesk monitoring artifacts

This directory contains configuration for the `kube-prometheus-stack` chart and an importable Grafana dashboard. The live classroom EKS project has this stack installed and the runtime result is recorded in [reports/runtime-evidence.md](../reports/runtime-evidence.md).

## Install Prometheus and Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/prometheus-values.yaml
```

The values file makes Prometheus consider ServiceMonitors across namespaces and disables the chart's release-label restriction. The OpsDesk Helm chart creates a ServiceMonitor for the backend at `/metrics`, with a 15-second scrape interval.

## Install the application target

Install `helm/taskboard` in the `opsdesk` namespace with image values that exist in the selected registry. The chart's default `monitoring.serviceMonitor.enabled` value is `false`; production values enable it.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/storageclass-gp3.yaml
kubectl create secret generic opsdesk-postgres \
  --namespace opsdesk \
  --from-literal=database-url='postgresql+psycopg://opsdesk:opsdesk@opsdesk-postgres:5432/opsdesk' \
  --from-literal=username='opsdesk' \
  --from-literal=password='replace-for-your-cluster'
helm upgrade --install opsdesk ./helm/taskboard \
  --namespace opsdesk \
  --create-namespace \
  --values ./helm/taskboard/values-prod.yaml \
   --set backend.image=992163310601.dkr.ecr.ap-south-1.amazonaws.com/opsdesk-backend \
   --set frontend.image=992163310601.dkr.ecr.ap-south-1.amazonaws.com/opsdesk-frontend \
   --set backend.tag=live-20261017 \
   --set frontend.tag=live-20261017-r2
```

Verify the target configuration:

```bash
kubectl get servicemonitor -A
kubectl get endpoints -n opsdesk opsdesk-backend
kubectl port-forward -n opsdesk svc/opsdesk-backend 8000:8000
curl http://127.0.0.1:8000/metrics
```

## Import the Grafana dashboard

Open Grafana and choose **Dashboards → Import**. Upload `monitoring/opsdesk-dashboard.json`, select the Prometheus datasource, and import it. The dashboard expects the Prometheus Operator labels `namespace="opsdesk"` and `service="opsdesk-backend"` added to scraped series.

With the dashboard sidecar enabled in `prometheus-values.yaml`, the same JSON can be provisioned from a ConfigMap:

```bash
kubectl create configmap opsdesk-dashboard \
  --namespace monitoring \
  --from-file=opsdesk-dashboard.json=monitoring/opsdesk-dashboard.json \
  --dry-run=client -o yaml \
  | kubectl label --local -f - grafana_dashboard=1 -o yaml \
  | kubectl apply -f -
```

Port-forward the bundled services when running locally in a cluster:

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
```

The Grafana admin password is stored in the chart-created Secret:

```bash
kubectl get secret kube-prometheus-stack-grafana -n monitoring \
  -o jsonpath='{.data.admin-password}' | base64 --decode; echo
```

If panels are empty, first check the Prometheus **Status → Targets** page and query `http_requests_total` without filters. Label names can differ when the ServiceMonitor or service name is changed; update the dashboard filters to match the discovered series.
