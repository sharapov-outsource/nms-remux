#!/bin/bash

# Set the name of your PM2 process
PROCESS_NAME="mediaserver"

echo "🛠️  Restarting PM2 process: $PROCESS_NAME"

# Check if the process is running
pm2 describe $PROCESS_NAME > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Process $PROCESS_NAME found. Stopping and deleting it..."
    pm2 delete $PROCESS_NAME
else
    echo "⚠️  Process $PROCESS_NAME not found. Skipping delete..."
fi

# Start the process again
echo "🚀 Starting process $PROCESS_NAME"
pm2 start index.js --name $PROCESS_NAME --watch --ignore-watch="node_modules"

# Show the status
echo "📋 Current PM2 status:"
pm2 status