#!/usr/bin/env bash
# wait-for-it.sh - Wait for a service to become available

set -e

# Default timeout is 15 seconds
TIMEOUT=15
QUIET=0
WAIT_HOST=""
WAIT_PORT=""
CHILD=0

usage() {
    cat << USAGE >&2
Usage:
    $0 host:port [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -q | --quiet                Don't output any status messages
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for() {
    if [ $TIMEOUT -gt 0 ]; then
        echo "Waiting $TIMEOUT seconds for $WAIT_HOST:$WAIT_PORT"
    else
        echo "Waiting for $WAIT_HOST:$WAIT_PORT without a timeout"
    fi
    
    start_ts=$(date +%s)
    
    while :
    do
        if [ $TIMEOUT -gt 0 ]; then
            now_ts=$(date +%s)
            elapsed=$((now_ts - start_ts))
            if [ $elapsed -ge $TIMEOUT ]; then
                echo "Timeout occurred after waiting $TIMEOUT seconds for $WAIT_HOST:$WAIT_PORT"
                return 1
            fi
        fi
        
        (echo > /dev/tcp/$WAIT_HOST/$WAIT_PORT) >/dev/null 2>&1
        result=$?
        
        if [ $result -eq 0 ]; then
            if [ $QUIET -ne 1 ]; then
                echo "$WAIT_HOST:$WAIT_PORT is available after $(($(date +%s) - start_ts)) seconds"
            fi
            break
        fi
        
        sleep 1
    done
    
    return 0
}

wait_for_wrapper() {
    # In order to support SIGTERM, the Docker container must
    # catch and relay the signal to this script
    trap "kill -TERM $CHILD 2>/dev/null" SIGTERM
    
    wait_for
    RESULT=$?
    
    if [ $RESULT -ne 0 ]; then
        echo "Timeout or error occurred"
        exit $RESULT
    fi
    
    if [ $# -gt 0 ]; then
        if [ $QUIET -ne 1 ]; then
            echo "Executing command: $@"
        fi
        exec "$@" &
        CHILD=$!
        wait $CHILD
        RESULT=$?
        exit $RESULT
    else
        exit 0
    fi
}

# Process arguments
while [ $# -gt 0 ]
do
    case "$1" in
        *:* )
        hostport=(${1//:/ })
        WAIT_HOST=${hostport[0]}
        WAIT_PORT=${hostport[1]}
        shift 1
        ;;
        -h)
        WAIT_HOST="$2"
        shift 2
        ;;
        --host=*)
        WAIT_HOST="${1#*=}"
        shift 1
        ;;
        -p)
        WAIT_PORT="$2"
        shift 2
        ;;
        --port=*)
        WAIT_PORT="${1#*=}"
        shift 1
        ;;
        -t)
        TIMEOUT="$2"
        shift 2
        ;;
        --timeout=*)
        TIMEOUT="${1#*=}"
        shift 1
        ;;
        -q | --quiet)
        QUIET=1
        shift 1
        ;;
        --)
        shift
        break
        ;;
        --help)
        usage
        ;;
        *)
        echo "Unknown argument: $1"
        usage
        ;;
    esac
done

if [ "$WAIT_HOST" = "" ] || [ "$WAIT_PORT" = "" ]; then
    echo "Error: Host and port must be specified"
    usage
fi

wait_for_wrapper "$@"