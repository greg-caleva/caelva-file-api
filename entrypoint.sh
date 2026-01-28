#!/bin/sh

# Check if hardware dir doesn't exist, or if it is empty
if [ ! -d "/app/data/hardware" ] || [ -z "$(ls -A /app/data/hardware 2>/dev/null)" ]; then
    echo "Seeding hardware data..."
    mkdir -p /app/data/hardware

    # copy in the hardware packageVersion from seed
    cp -r /app/seed/hardware/* /app/data/hardware/ 2>/dev/null || true
fi

# Seed demo data if DEMO_MODE is enabled
if [ "$DEMO_MODE" = "true" ]; then

    # In demo mode, clear all files
    rm -rf /app/data/files 2>/dev/null

     # Always seed data from image in demo mode
    echo "Seeding data volume..."
    mkdir -p /app/data/files
    cp -r /app/seed/files/* /app/data/files/ 2>/dev/null || true

    mkdir -p /app/data/hardware/NEW_VERSION
fi

# Start the app
exec node dist/server.js
