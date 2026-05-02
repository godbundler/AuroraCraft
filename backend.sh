#!/bin/bash
# Simple backend management script

PIDFILE="/tmp/auroracraft-backend.pid"
LOGDIR="/workspaces/AuroraCraft/logs"
TSX="/usr/local/share/nvm/versions/node/v24.11.1/bin/tsx"
SCRIPT="/workspaces/AuroraCraft/server/src/index.ts"

start() {
    if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
        echo "Backend is already running (PID: $(cat $PIDFILE))"
        return 1
    fi
    
    echo "Starting backend..."
    cd /workspaces/AuroraCraft
    $TSX $SCRIPT >> "$LOGDIR/server-out.log" 2>> "$LOGDIR/server-error.log" &
    local PID=$!
    echo $PID > "$PIDFILE"
    sleep 2
    
    if kill -0 $PID 2>/dev/null; then
        echo "Backend started (PID: $PID)"
    else
        echo "Failed to start backend"
        rm -f "$PIDFILE"
        return 1
    fi
}

stop() {
    if [ ! -f "$PIDFILE" ]; then
        echo "Backend is not running"
        return 1
    fi
    
    PID=$(cat "$PIDFILE")
    echo "Stopping backend (PID: $PID)..."
    kill $PID 2>/dev/null
    sleep 2
    
    if kill -0 $PID 2>/dev/null; then
        echo "Force killing..."
        kill -9 $PID 2>/dev/null
    fi
    
    rm -f "$PIDFILE"
    echo "Backend stopped"
}

status() {
    if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
        PID=$(cat "$PIDFILE")
        echo "Backend is running (PID: $PID)"
        ps -p $PID -o pid,user,cmd
    else
        echo "Backend is not running"
        [ -f "$PIDFILE" ] && rm -f "$PIDFILE"
        return 1
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 1
        start
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
