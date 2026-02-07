#!/usr/bin/bash

# =============================================
# Usage:
#   ./set-anthropic-env.sh on    → sets the variables
#   ./set-anthropic-env.sh off   → unsets the variables
#   ./set-anthropic-env.sh       → shows current status
# =============================================


ACTION="${1:-status}"

case "$ACTION" in
  on|enable|set|export)
    echo "Setting Anthropic / OpenRouter environment variables..."

    # Change these values to your actual keys/URLs
    export ANTHROPIC_API_KEY=""
    export ANTHROPIC_AUTH_TOKEN="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"
    export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
    export ANTHROPIC_MODEL_OVERRIDE="kwaipilot/kat-coder-pro"

    echo "Done. Current values:"
    echo "  ANTHROPIC_API_KEY        = ${ANTHROPIC_API_KEY:0:6}... (hidden)"
    echo "  ANTHROPIC_AUTH_TOKEN     = ${ANTHROPIC_AUTH_TOKEN:0:6}..."
    echo "  ANTHROPIC_BASE_URL       = $ANTHROPIC_BASE_URL"
    echo "  ANTHROPIC_MODEL_OVERRIDE = $ANTHROPIC_MODEL_OVERRIDE"

    export | grep ANTHROPIC
    ;;

  off|unset|clear|disable)
    echo "Unsetting Anthropic environment variables..."

    unset ANTHROPIC_API_KEY
    unset ANTHROPIC_AUTH_TOKEN
    unset ANTHROPIC_BASE_URL
    unset ANTHROPIC_MODEL_OVERRIDE

    echo "Variables removed."
    ;;

  status|show|current)
    echo "Current Anthropic / OpenRouter environment variables:"
    echo
    echo "ANTHROPIC_API_KEY        = ${ANTHROPIC_API_KEY:+set (${ANTHROPIC_API_KEY:0:6}...)}"
    echo "ANTHROPIC_AUTH_TOKEN     = ${ANTHROPIC_AUTH_TOKEN:+set}"
    echo "ANTHROPIC_BASE_URL       = ${ANTHROPIC_BASE_URL:-not set}"
    echo "ANTHROPIC_MODEL_OVERRIDE = ${ANTHROPIC_MODEL_OVERRIDE:-not set}"
    ;;

  *)
    echo "Usage: $0 {on | off | status}"
    echo
    echo "  on      - export the variables"
    echo "  off     - remove the variables"
    echo "  status  - show current state (default when no argument)"
    exit 1
    ;;
esac