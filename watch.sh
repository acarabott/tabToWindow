#!/bin/bash

echo "watching..."

while true; do
    npm run build &&
        echo "updated"
    sleep 1.5
done
