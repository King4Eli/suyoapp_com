#!/bin/bash

generate_cert() {
  DOMAIN="$1"
  SAN="$2"

  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "${DOMAIN}.key" \
    -out "${DOMAIN}.crt" \
    -subj "/CN=*.${DOMAIN}" \
    -addext "subjectAltName=${SAN}" \
    -addext "basicConstraints=critical,CA:true" \
    -addext "keyUsage=critical,keyCertSign,cRLSign,digitalSignature"

  read -p "Install ${DOMAIN}.crt into Debian trusted store? (y/N): " CONFIRM

  if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
    sudo cp "${DOMAIN}.crt" "/usr/local/share/ca-certificates/${DOMAIN}.crt"
    sudo update-ca-certificates
    echo "${DOMAIN}.crt installed."
  else
    echo "Skipped install for ${DOMAIN}.crt"
  fi
}

generate_cert "suyoapp.local" \
"DNS:*.suyoapp.local,DNS:suyoapp.local,DNS:*.in.suyoapp.local"

generate_cert "global.local" \
"DNS:*.global.local,DNS:global.local,DNS:*.in.global.local"
