#!/bin/sh
echo "const ENV = { EVOLUTION_INSTANCE: '${EVOLUTION_INSTANCE:-meu-numero}' };" > /usr/share/nginx/html/env.js
