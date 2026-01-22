# Geist 폰트 파일 추가 가이드

## 📥 방법 1: GitHub에서 직접 다운로드 (권장)

### 1단계: GitHub에서 폰트 다운로드

1. 브라우저에서 다음 링크를 엽니다:
   - **최신 릴리즈**: https://github.com/vercel/geist-font/releases/latest
   - **메인 저장소**: https://github.com/vercel/geist-font

2. 릴리즈 페이지에서:
   - `Source code (zip)` 또는 `geist-font-v*.zip` 파일을 다운로드합니다
   - 또는 저장소에서 `Code` → `Download ZIP`을 클릭합니다

### 2단계: ZIP 파일 압축 해제

다운로드한 ZIP 파일을 압축 해제합니다.

### 3단계: 폰트 파일 찾기

압축 해제한 폴더에서 다음 경로를 찾습니다:
- `packages/geist/dist/ttf/` 또는
- `fonts/ttf/` 또는
- 직접 `.ttf` 파일이 있는 폴더

### 4단계: 필요한 파일 복사

다음 4개의 `.ttf` 파일을 찾아서 복사합니다:

- `Geist-Regular.ttf` (또는 `GeistVF-Regular.ttf`)
- `Geist-Medium.ttf` (또는 `GeistVF-Medium.ttf`)
- `Geist-SemiBold.ttf` (또는 `GeistVF-SemiBold.ttf`)
- `Geist-Bold.ttf` (또는 `GeistVF-Bold.ttf`)

**참고**: Variable Font 버전(`GeistVF-*.ttf`)을 사용할 수도 있습니다.

### 5단계: 프로젝트에 파일 추가

복사한 4개의 `.ttf` 파일을 다음 경로에 붙여넣습니다:

```
/Users/siro/Documents/dev/TodayCheck/assets/fonts/
```

**최종 파일 구조:**
```
assets/fonts/
  ├── Geist-Regular.ttf      ← 여기에 복사
  ├── Geist-Medium.ttf       ← 여기에 복사
  ├── Geist-SemiBold.ttf     ← 여기에 복사
  ├── Geist-Bold.ttf         ← 여기에 복사
  ├── OFL.txt                (이미 있음)
  └── README.md              (이미 있음)
```

### 6단계: 파일 이름 확인

파일 이름이 정확히 일치하는지 확인하세요:
- ✅ `Geist-Regular.ttf` (정확)
- ❌ `geist-regular.ttf` (대소문자 다름)
- ❌ `Geist Regular.ttf` (공백 있음)
- ❌ `Geist-Regular.TTF` (확장자 대문자)

---

## 📦 방법 2: npm으로 설치 (대안)

터미널에서 다음 명령어를 실행합니다:

```bash
cd /Users/siro/Documents/dev/TodayCheck
npm install geist-font
```

설치 후, `node_modules/geist-font/dist/ttf/` 폴더에서 `.ttf` 파일을 찾아서 `assets/fonts/`로 복사합니다.

---

## ✅ 파일 추가 확인

파일을 추가한 후, 다음 명령어로 확인할 수 있습니다:

```bash
ls -la assets/fonts/
```

다음과 같이 보여야 합니다:
```
Geist-Bold.ttf
Geist-Medium.ttf
Geist-Regular.ttf
Geist-SemiBold.ttf
OFL.txt
README.md
```

---

## 🔧 코드 활성화

파일을 추가한 후, `app/_layout.tsx` 파일에서 주석을 해제하세요:

```typescript
const [fontsLoaded, fontError] = useFonts({
  'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
  'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
  'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
  'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
});
```

그리고 `useEffect`도 수정:

```typescript
useEffect(() => {
  if (fontsLoaded || fontError) {
    SplashScreen.hideAsync();
  }
}, [fontsLoaded, fontError]);
```

---

## 🚀 앱 재시작

파일을 추가하고 코드를 활성화한 후:

```bash
npm start
```

그리고 앱을 재시작하세요. Geist 폰트가 적용됩니다!

---

## ❓ 문제 해결

### "Unable to resolve module" 에러가 계속 나는 경우:

1. **파일 경로 확인**: `assets/fonts/` 디렉토리에 파일이 있는지 확인
2. **파일 이름 확인**: 대소문자와 확장자가 정확한지 확인
3. **캐시 클리어**: 
   ```bash
   npm start -- --clear
   ```
4. **Metro 번들러 재시작**: 터미널에서 `r` 키를 눌러 리로드

### 폰트가 적용되지 않는 경우:

1. **코드 활성화 확인**: `app/_layout.tsx`에서 주석이 해제되었는지 확인
2. **앱 재시작**: 완전히 종료 후 다시 시작
3. **콘솔 확인**: 폰트 로딩 에러가 있는지 확인
