#!/bin/bash

BUILD_DIR="../build"
JS_DIR="js"

mkdir -p $JS_DIR &&
    rm -f "${JS_DIR:?}/"* &&
    npx tsc -p . &&
    mkdir -p $BUILD_DIR &&
    rm -rf "${BUILD_DIR:?}/"* &&
    cp -R css $JS_DIR lib icons LICENSE manifest.json options.html $BUILD_DIR
echo "done"
