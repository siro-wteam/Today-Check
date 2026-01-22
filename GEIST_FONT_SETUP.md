# Geist 폰트 설정 가이드

## 📥 1. 폰트 파일 다운로드

Geist 폰트 파일을 다운로드하고 프로젝트에 추가해야 합니다.

### 다운로드 방법

1. **GitHub에서 다운로드:**
   - https://github.com/vercel/geist-font/releases
   - 최신 릴리즈를 다운로드하세요

2. **또는 npm으로 설치:**
   ```bash
   npm install geist-font
   ```
   설치 후 `node_modules/geist-font/dist/ttf/` 폴더에서 폰트 파일을 복사하세요.

### 필요한 폰트 파일

다음 파일들을 `assets/fonts/` 디렉토리에 복사하세요:

- `Geist-Regular.ttf` (400)
- `Geist-Medium.ttf` (500)
- `Geist-SemiBold.ttf` (600)
- `Geist-Bold.ttf` (700)

### 최종 디렉토리 구조

```
assets/fonts/
  ├── Geist-Regular.ttf
  ├── Geist-Medium.ttf
  ├── Geist-SemiBold.ttf
  ├── Geist-Bold.ttf
  ├── OFL.txt (라이선스 파일 - 이미 생성됨)
  └── README.md
```

## ✅ 2. 코드 적용 완료

다음 파일들이 이미 수정되었습니다:

- ✅ `app/_layout.tsx` - 폰트 로딩 코드 추가
- ✅ `constants/colors.ts` - 폰트 패밀리 정의 추가
- ✅ `lib/fonts.ts` - 폰트 유틸리티 함수 생성
- ✅ `assets/fonts/OFL.txt` - 라이선스 파일 생성

## 🎨 3. 폰트 사용 방법

### 방법 1: 직접 fontFamily 지정

```tsx
import { typography } from '@/constants/colors';

<Text style={{ fontFamily: typography.fontFamily.regular }}>
  Regular text
</Text>

<Text style={{ fontFamily: typography.fontFamily.bold }}>
  Bold text
</Text>
```

### 방법 2: 유틸리티 함수 사용

```tsx
import { getFontStyle } from '@/lib/fonts';

<Text style={[getFontStyle('regular'), { fontSize: 16 }]}>
  Regular text
</Text>

<Text style={[getFontStyle('bold'), { fontSize: 18 }]}>
  Bold text
</Text>
```

### 방법 3: fontWeight와 함께 사용

```tsx
import { typography } from '@/constants/colors';

<Text style={{ 
  fontFamily: typography.fontFamily.regular,
  fontWeight: typography.bold 
}}>
  Bold text with Geist font
</Text>
```

## ⚠️ 4. 주의사항

1. **폰트 파일이 없으면 앱이 크래시할 수 있습니다**
   - 폰트 파일을 반드시 `assets/fonts/` 디렉토리에 추가하세요
   - 파일 이름이 정확히 일치해야 합니다

2. **라이선스 준수**
   - `OFL.txt` 파일이 이미 포함되어 있습니다
   - 앱 출시 시 라이선스 정보를 명시하세요

3. **앱 크기**
   - 폰트 파일은 앱 크기를 증가시킵니다
   - 필요한 weight만 포함하는 것을 권장합니다

## 🚀 5. 테스트

폰트 파일을 추가한 후:

1. 앱을 재시작하세요
2. 모든 텍스트가 Geist 폰트로 표시되는지 확인하세요
3. 폰트 로딩이 실패하면 에러가 표시됩니다

## 📝 6. 라이선스 정보

Geist 폰트는 SIL Open Font License 1.1 (OFL-1.1)로 라이선스되어 있습니다.
- 상업적 사용 가능
- 수정 및 재배포 가능
- 라이선스 파일 포함 필수

자세한 내용은 `assets/fonts/OFL.txt` 파일을 참조하세요.
