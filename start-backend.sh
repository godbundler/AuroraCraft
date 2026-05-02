#!/bin/bash
cd /workspaces/AuroraCraft
exec tsx server/src/index.ts >> logs/server-out.log 2>> logs/server-error.log
