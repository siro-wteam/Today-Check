# Supabase Storage 설정 가이드

## 프로필 이미지 및 그룹 이미지 업로드를 위한 Storage 설정

### 1. 버킷 생성 (Supabase Dashboard)

1. **Supabase Dashboard 접속**
   - https://app.supabase.com 접속
   - 프로젝트 선택

2. **Storage 메뉴로 이동**
   - 왼쪽 메뉴에서 **Storage** 클릭

3. **버킷 생성**
   - **"Create Bucket"** 버튼 클릭
   - 설정:
     - **Name**: `avatars` (정확히 이 이름으로)
     - **Public bucket**: **ON** (토글 활성화) ⚠️ 중요!
     - **File size limit**: `5242880` (5MB)
     - **Allowed MIME types**: `image/jpeg, image/png, image/gif, image/webp`
   - **"Create bucket"** 클릭

### 2. Storage 정책 설정 (Supabase Dashboard)

Storage 정책은 SQL로 직접 생성할 수 없으므로 Dashboard에서 설정해야 합니다.

#### Policy 1: Public Avatar Access (SELECT)

1. **Storage > Policies** 메뉴로 이동
2. **"avatars"** 버킷 선택
3. **"New Policy"** 클릭
4. 설정:
   - **Policy name**: `Public Avatar Access`
   - **Allowed operations**: `SELECT` 체크
   - **Target roles**: `anon`, `authenticated` 모두 체크
   - **USING expression**:
     ```sql
     bucket_id = 'avatars'
     ```
5. **"Review"** → **"Save policy"** 클릭

#### Policy 2: Users can upload their own avatars (INSERT)

1. **"New Policy"** 클릭
2. 설정:
   - **Policy name**: `Users can upload their own avatars`
   - **Allowed operations**: `INSERT` 체크
   - **Target roles**: `authenticated` 체크
   - **WITH CHECK expression**:
     ```sql
     bucket_id = 'avatars' 
     AND (name ~ ('^' || auth.uid()::text || '/'))
     ```
     **참고**: 그룹 이미지는 `{userId}/groups/{groupId}/...` 경로로 저장되므로 이 정책으로 충분합니다.
3. **"Review"** → **"Save policy"** 클릭

#### Policy 3: Users can update their own avatars (UPDATE)

1. **"New Policy"** 클릭
2. 설정:
   - **Policy name**: `Users can update their own avatars`
   - **Allowed operations**: `UPDATE` 체크
   - **Target roles**: `authenticated` 체크
   - **USING expression**:
     ```sql
     bucket_id = 'avatars' 
     AND (name ~ ('^' || auth.uid()::text || '/'))
     ```
3. **"Review"** → **"Save policy"** 클릭

#### Policy 4: Users can delete their own avatars (DELETE)

1. **"New Policy"** 클릭
2. 설정:
   - **Policy name**: `Users can delete their own avatars`
   - **Allowed operations**: `DELETE` 체크
   - **Target roles**: `authenticated` 체크
   - **USING expression**:
     ```sql
     bucket_id = 'avatars' 
     AND (name ~ ('^' || auth.uid()::text || '/'))
     ```
3. **"Review"** → **"Save policy"** 클릭

### 3. 파일 경로 구조

- **프로필 이미지**: `{userId}/{timestamp}.{ext}` (예: `abc-123/1234567890.jpg`)
- **그룹 이미지**: `{userId}/groups/{groupId}/{timestamp}.{ext}` (예: `abc-123/groups/xyz-456/1234567890.jpg`)

이 구조를 사용하면 기존 Storage 정책(`name ~ ('^' || auth.uid()::text || '/')`)을 그대로 사용할 수 있으며, 그룹 오너 권한은 애플리케이션 레벨에서 검증됩니다.

### 4. 확인 사항

설정이 완료되면 다음을 확인하세요:

- ✅ 버킷 이름이 정확히 `avatars`인지
- ✅ Public bucket이 **ON**인지
- ✅ 4개의 정책이 모두 생성되었는지 (SELECT, INSERT, UPDATE, DELETE)
- ✅ INSERT, UPDATE, DELETE 정책에 그룹 오너 체크 로직이 포함되어 있는지

### 5. 테스트

설정 완료 후 앱에서:
- 프로필 이미지를 업로드해보세요 (사용자 ID 폴더)
- 그룹 이미지를 업로드해보세요 (그룹 ID 폴더, 오너만 가능)

성공하면:
- 이미지가 Storage에 업로드됨
- 프로필/그룹에 새로운 이미지가 표시됨
- 성공 토스트 메시지 표시

### 문제 해결

**"JSON Parse error: Unexpected character: <" 에러:**
- 버킷이 존재하지 않거나 Public이 아닌 경우
- → 버킷 생성 및 Public 설정 확인

**"Storage permission denied" 또는 "new row violates row-level security policy" 에러:**
- Storage 정책이 올바르게 설정되지 않은 경우
- → 위의 정책 설정 단계를 다시 확인
- → 특히 INSERT 정책의 WITH CHECK 표현식이 그룹 오너 체크를 포함하는지 확인

**"Storage bucket not found" 에러:**
- 버킷 이름이 `avatars`가 아닌 경우
- → 버킷 이름 확인 및 수정
