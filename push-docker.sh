#!/bin/bash

TAG=$(git describe --tags --abbrev=0)

docker buildx build -t skybook:"$TAG" .

docker push lanticss/skybook:"$TAG"