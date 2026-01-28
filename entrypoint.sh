#!/bin/sh

# Seed data if volume is empty
if [ ! -d "/app/data/files" ] || [ -z "$(ls -A /app/data/files 2>/dev/null)" ]; then
    echo "Seeding data volume..."
    mkdir -p /app/data/files
    cp -r /app/seed/files/* /app/data/files/ 2>/dev/null || true
fi

# Start the app
exec node dist/server.js
