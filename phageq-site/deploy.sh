#!/bin/bash
set -e
echo "🧬 deploying phageq-site..."
npm install
npm run build
if pm2 list | grep -q "phageq-site"; then
  pm2 restart phageq-site
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi
echo "🧬 done"
