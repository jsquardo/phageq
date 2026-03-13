#!/bin/bash
set -e
cd /var/www/phageq/phageq-site
npm run build -- --outDir dist-next
rm -rf dist-prev
mv dist dist-prev
mv dist-next dist
echo "Rebuild complete"
