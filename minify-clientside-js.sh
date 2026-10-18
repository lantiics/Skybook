#!/bin/bash
find ./src/public/js -name "*.js" -not -name "*.min.js" | while read f; do
   bun terser "$f" -o "${f%.js}.min.js" -c -m
done
