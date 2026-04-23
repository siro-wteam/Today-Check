#!/usr/bin/env bash
# TypeScript baseline enforcement.
# Pre-existing tsc errors가 감소/유지되는지 확인. 새 regression은 차단.
# Baseline 수는 .typecheck-baseline 파일에 기록.

set -uo pipefail

BASELINE_FILE=".typecheck-baseline"

if [ ! -f "$BASELINE_FILE" ]; then
  echo "❌ $BASELINE_FILE 파일이 없습니다. 현재 에러 개수를 기록해 주세요:"
  echo "   echo <N> > $BASELINE_FILE"
  exit 1
fi

BASELINE=$(tr -d '[:space:]' < "$BASELINE_FILE")
ACTUAL=$(npx tsc --noEmit 2>&1 | grep -cE "^[^ ].*error TS" || true)

echo "Baseline: $BASELINE (from $BASELINE_FILE)"
echo "Actual:   $ACTUAL"

if [ "$ACTUAL" -gt "$BASELINE" ]; then
  NEW_ERRORS=$((ACTUAL - BASELINE))
  echo ""
  echo "❌ TypeScript 에러가 baseline을 초과했습니다 (+$NEW_ERRORS)"
  echo "   신규 에러를 수정하거나, baseline을 (정당한 경우) 올려야 합니다."
  echo ""
  echo "처음 30개 에러:"
  npx tsc --noEmit 2>&1 | grep -E "^[^ ].*error TS" | head -30
  exit 1
fi

if [ "$ACTUAL" -lt "$BASELINE" ]; then
  DECREASE=$((BASELINE - ACTUAL))
  echo ""
  echo "✨ 에러 감소 감지: $BASELINE → $ACTUAL (-$DECREASE)"
  echo "   $BASELINE_FILE 파일을 $ACTUAL 로 업데이트해 주세요 (ratchet):"
  echo "   echo $ACTUAL > $BASELINE_FILE"
  # warning만, fail X. 추후 strict ratchet으로 전환 가능.
fi

echo "✅ TypeScript baseline OK"
