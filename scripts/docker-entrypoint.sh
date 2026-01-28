#!/bin/sh
set -e

# Run demo seed if DEMO_MODE is enabled
if [ "$DEMO_MODE" = "true" ]; then
    /app/scripts/seed-demo-data.sh
fi

# Execute the main command
exec "$@"
