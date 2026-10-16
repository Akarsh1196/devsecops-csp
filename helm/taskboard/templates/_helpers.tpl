{{/*
Return the chart name used in labels.
*/}}
{{- define "opsdesk.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Return the release-scoped resource prefix. All services, workloads, and
references use this helper so names remain consistent across the chart.
*/}}
{{- define "opsdesk.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
