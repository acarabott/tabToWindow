#!/bin/bash

BUILD_DIR="../build"

echo "watching..."

while true; do
    rm -rf $"BUILD_DIR/*" &&
        mkdir -p $BUILD_DIR &&
        npx tsc -p . &&
        cp -R js css lib icons LICENSE manifest.json options.html $BUILD_DIR
    echo "updated"
    sleep 1.5
done
