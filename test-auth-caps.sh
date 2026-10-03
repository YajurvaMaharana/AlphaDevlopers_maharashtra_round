#!/bin/bash

echo "Running auth caps tests (demanding DEMO_MODE=true on server)..."

echo "=== Test 1: Register and Verify 3 accounts on the same Device FP & Subnet ==="
for i in 1 2 3; do
  IP="10.0.0.1" # Same IP subnet
  echo "Registering testuser$i@example.com from IP $IP..."
  RES=$(curl -s -X POST http://localhost/auth/register \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $IP" \
    -d "{\"email\":\"testuser$i@example.com\"}")
  
  OTP=$(echo $RES | grep -o '"otp":"[^"]*' | grep -o '[^"]*$')
  echo "OTP: $OTP"
  
  if [ -n "$OTP" ]; then
    echo "Verifying testuser$i@example.com..."
    VERIFY_RES=$(curl -s -X POST http://localhost/auth/verify \
      -H "Content-Type: application/json" \
      -H "X-Forwarded-For: $IP" \
      -d "{\"email\":\"testuser$i@example.com\",\"otp\":\"$OTP\",\"deviceFp\":\"fp-1\"}")
    echo $VERIFY_RES
  fi
  echo "---"
done

echo "=== Test 2: Register 4th account (Should get risk_tier=high) ==="
IP="10.0.0.2" # Same subnet! Will trigger subnet cap. We also use the same fp-1 to trigger device cap.
echo "Registering testuser4@example.com from IP $IP..."
RES=$(curl -s -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: $IP" \
  -d "{\"email\":\"testuser4@example.com\"}")

OTP=$(echo $RES | grep -o '"otp":"[^"]*' | grep -o '[^"]*$')
echo "OTP: $OTP"

if [ -n "$OTP" ]; then
  echo "Verifying testuser4@example.com..."
  VERIFY_RES=$(curl -s -X POST http://localhost/auth/verify \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $IP" \
    -d "{\"email\":\"testuser4@example.com\",\"otp\":\"$OTP\",\"deviceFp\":\"fp-1\"}")
  echo $VERIFY_RES
fi
echo "---"

echo "=== Test 3: Register 5th account with different FP and different subnet (Should be normal) ==="
IP="10.0.1.5" # Different subnet
echo "Registering testuser5@example.com from IP $IP..."
RES=$(curl -s -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: $IP" \
  -d "{\"email\":\"testuser5@example.com\"}")

OTP=$(echo $RES | grep -o '"otp":"[^"]*' | grep -o '[^"]*$')
echo "OTP: $OTP"

if [ -n "$OTP" ]; then
  echo "Verifying testuser5@example.com..."
  VERIFY_RES=$(curl -s -X POST http://localhost/auth/verify \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: $IP" \
    -d "{\"email\":\"testuser5@example.com\",\"otp\":\"$OTP\",\"deviceFp\":\"fp-2\"}")
  echo $VERIFY_RES
fi
