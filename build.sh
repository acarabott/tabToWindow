#!/bin/bash

if [[ -z "${npm_package_version}" ]]; then
    echo "could not detect version, must be run with \$npm run build"
    exit 1
fi

VERSION="$npm_package_version"

BUILD_DIR="build" # this must match tsconfig.json:compilerOptions:outDir

npx tsc -p . &&
    mkdir -p "$BUILD_DIR" &&
    cp -R src/background.html src/css src/icons src/lib src/manifest.json src/options.html "$BUILD_DIR" &&
    zip -r "build-tab-to-window-$VERSION".zip "$BUILD_DIR"
