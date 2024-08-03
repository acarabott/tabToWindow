#!/bin/bash

JS_DIR="js"
BUILD_DIR="../build"

mkdir -p $BUILD_DIR
cp -R css lib icons LICENSE manifest.json options.html $BUILD_DIR

echo "watching..."

while true; do
    rm -rf $JS_DIR &&
        npx tsc -p . &&
        rm -rf $BUILD_DIR/js &&
        cp -R $JS_DIR $BUILD_DIR &&
        echo "updated"
    sleep 1.5
done
