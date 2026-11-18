#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf 'FRONTLINE V18: http://localhost:3000\n'
exec npm start
