#!/bin/bash

BUILD_DIR="../build"

mkdir -p $BUILD_DIR
cp -R css lib icons LICENSE manifest.json options.html $BUILD_DIR

while true; do
    echo "building..." &&
        npx tsc -p . &&
        rm -rf $BUILD_DIR/js &&
        cp -R js $BUILD_DIR
    sleep 1.5 
done
