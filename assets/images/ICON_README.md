# 앱 아이콘 (상단 디자인: 파란 스쿼시 + 흰색 체크)

- **스타일**: 파란색 둥근 사각형(스쿼시) 배경 위에 흰색 체크마크. 플랫 디자인.
- **적용**: iOS, Android, 웹( favicon ) 공통.

## 파일

| 파일 | 용도 | 크기 |
|------|------|------|
| **icon.png** | 앱 아이콘 (iOS·Android·웹 공용) | 1024×1024 |
| **favicon-16.png** | 웹 favicon (브라우저 탭) | 16×16 |
| **favicon-32.png** | 웹 favicon | 32×32 |
| **favicon-192.png** | PWA / 웹 앱 아이콘 | 192×192 |
| **favicon-512.png** | PWA / 웹 앱 아이콘 | 512×512 |

- **app.json**: `icon`, `web.favicon` → `./assets/images/icon.png`
- **Android 적응형**: `foregroundImage` → `icon.png`, `backgroundColor` → `#3B82F6` (파란 배경)

## 네이티브에 반영

아이콘을 바꾼 뒤 iOS/Android에 적용하려면:

```bash
npx expo prebuild --clean --platform android
npx expo prebuild --clean --platform ios
```

그 다음 각 플랫폼으로 빌드/실행하면 됩니다.
