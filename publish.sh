#!/bin/bash

BUILD_DIR="build";

npm run build && \
mkdir -p $BUILD_DIR && \
    cp -R background.html css js lib icons LICENSE manifest.json options.html $BUILD_DIR && \
    zip -r build.zip $BUILD_DIR
