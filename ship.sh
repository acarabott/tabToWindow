#!/bin/bash

set -e
SRC="build"
HASH=$(git rev-parse --short HEAD)
ZIP="tabToWindow-$HASH.zip"

./build.sh

pushd .. &&
    echo "deleting existing zip" &&
    rm -rf "./tabToWindow-*.zip"

# Check if the build directory exists in the parent folder
if [ ! -d "$SRC" ]; then
    echo "Error: 'build' directory not found"
    exit 1
fi

# zip and check ifsuccessful
if zip -r "$ZIP" $SRC; then
    echo "Successfully created $ZIP"
else
    echo "Error: Failed to create $ZIP"
    exit 1
fi

# popd || exit
