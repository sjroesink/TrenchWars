#!/usr/bin/env bash
# Generate a self-signed TLS certificate for WebTransport development.
# Certificate is valid for 14 days (required for serverCertificateHashes).
#
# Usage: ./scripts/gen-dev-cert.sh
# Output: certs/dev.cert and certs/dev.key

set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$CERT_DIR"

CERT="$CERT_DIR/dev.cert"
KEY="$CERT_DIR/dev.key"

echo "Generating self-signed TLS certificate (14-day validity)..."

openssl req -x509 \
  -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 \
  -keyout "$KEY" \
  -out "$CERT" \
  -days 14 \
  -nodes \
  -subj "//CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Compute SHA-256 fingerprint for serverCertificateHashes
HASH=$(openssl x509 -in "$CERT" -outform DER | openssl dgst -sha256 -binary | base64)

echo ""
echo "Certificate: $CERT"
echo "Private key: $KEY"
echo "SHA-256 hash: $HASH"
echo ""
echo "Start server with WebTransport:"
echo "  WT_PORT=9021 TLS_CERT=$CERT TLS_KEY=$KEY npm run dev"
