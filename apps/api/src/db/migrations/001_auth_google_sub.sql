-- Migration 001: Add google_sub unique, auth_method ('google' | 'otp'), and fair_id
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  google_sub VARCHAR(255) UNIQUE,
  fair_id VARCHAR(64) UNIQUE,
  auth_method VARCHAR(20) NOT NULL DEFAULT 'otp' CHECK (auth_method IN ('google', 'otp')),
  risk_tier VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (risk_tier IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
CREATE INDEX IF NOT EXISTS idx_users_fair_id ON users(fair_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
