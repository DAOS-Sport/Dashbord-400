#!/bin/bash
set -e

npm install
npx drizzle-kit push --force
node scripts/apply-db-retirement-migrations.cjs
