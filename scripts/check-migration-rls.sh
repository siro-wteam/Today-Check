#!/usr/bin/env bash
# Supabase migration RLS 검증.
# PR에서 변경된 supabase/migrations/*.sql 파일을 대상으로:
#   1. CREATE TABLE 이 있으면 ENABLE ROW LEVEL SECURITY 도 같은 파일에 필수
#   2. ENABLE ROW LEVEL SECURITY 가 있으면 CREATE POLICY 최소 1개 필수
# 규칙: .claude/rules/supabase-rls-mandatory.md

set -uo pipefail

BASE_REF="${1:-main}"

# origin/<ref>이 있으면 그것을, 없으면 로컬 <ref>를 비교 기준으로
if git rev-parse "origin/$BASE_REF" >/dev/null 2>&1; then
  DIFF_BASE="origin/$BASE_REF"
else
  DIFF_BASE="$BASE_REF"
fi

# 변경된 migration 파일 목록 (삭제는 제외)
CHANGED_FILES=$(git diff --name-only --diff-filter=AM "$DIFF_BASE"...HEAD -- 'supabase/migrations/*.sql' 2>/dev/null || true)

if [ -z "$CHANGED_FILES" ]; then
  echo "변경된 migration 없음. skip."
  exit 0
fi

echo "검사 대상 migration 파일:"
echo "$CHANGED_FILES" | sed 's/^/  - /'
echo ""

FAILED=0

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  [ ! -f "$FILE" ] && continue

  # CREATE TABLE 패턴 (ALTER / DROP 은 배제)
  if grep -qiE "^\s*CREATE\s+TABLE" "$FILE"; then
    # ENABLE ROW LEVEL SECURITY 체크
    if ! grep -qiE "ENABLE\s+ROW\s+LEVEL\s+SECURITY" "$FILE"; then
      echo "❌ $FILE"
      echo "   CREATE TABLE이 있지만 'ENABLE ROW LEVEL SECURITY'가 없습니다."
      echo "   같은 파일에 다음을 추가해 주세요:"
      echo "     ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;"
      echo ""
      FAILED=$((FAILED + 1))
      continue
    fi

    # CREATE POLICY 최소 1개 체크
    if ! grep -qiE "CREATE\s+POLICY" "$FILE"; then
      echo "❌ $FILE"
      echo "   ENABLE ROW LEVEL SECURITY는 있지만 CREATE POLICY가 0개입니다."
      echo "   RLS만 켜고 정책이 없으면 모든 접근이 차단되어 앱이 동작하지 않습니다."
      echo "   SELECT/INSERT/UPDATE/DELETE 중 필요한 정책을 추가해 주세요."
      echo ""
      FAILED=$((FAILED + 1))
      continue
    fi

    echo "✅ $FILE"
    echo "   CREATE TABLE + RLS 활성화 + CREATE POLICY 확인"
  else
    echo "⏭️  $FILE"
    echo "   CREATE TABLE 없음 (ALTER/DROP/INSERT만) — skip"
  fi
  echo ""
done <<< "$CHANGED_FILES"

if [ "$FAILED" -gt 0 ]; then
  echo "──────────────────────────────"
  echo "❌ RLS 검증 실패: $FAILED 개 파일"
  echo "   규칙 문서: .claude/rules/supabase-rls-mandatory.md"
  exit 1
fi

echo "──────────────────────────────"
echo "✅ 모든 migration이 RLS 요구사항을 충족합니다."
