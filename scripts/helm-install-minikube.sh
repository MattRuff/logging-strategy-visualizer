#!/usr/bin/env bash
# Build the image into Minikube's Docker daemon and install / upgrade the Helm release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

eval "$(minikube docker-env)"
docker build -t logging-strategy:0.1.0 .

helm upgrade --install logging-strategy "$ROOT/deploy/helm/logging-strategy" \
  --namespace logging-strategy \
  --create-namespace \
  --set image.pullPolicy=Never \
  --wait \
  --timeout 120s

echo ""
echo "Open the app (pick one):"
echo "  minikube service logging-strategy -n logging-strategy --url"
echo "  kubectl port-forward -n logging-strategy svc/logging-strategy 8080:80"
echo "  # then http://127.0.0.1:8080"
