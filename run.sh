#!/bin/bash

set -e

echo "==> Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "==> node_modules not found, running npm install..."
  npm install
else
  echo "==> node_modules found, skipping install."
fi

echo "==> Starting the application..."
npm start