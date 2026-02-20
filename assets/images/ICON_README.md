# App icon (하얀 배경 + 블루 아이콘)

- **스타일**: 흰색(또는 밝은) 배경 위에 파란색 아이콘 (Webull 앱 아이콘과 유사).
- **필요 파일**:
  - `icon.png` — iOS/웹 공용 (권장 1024×1024).
  - Android 적응형: `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png` (필요 시).
- **app.json**: `icon`, `web.favicon` → `./assets/images/icon.png`. Android `adaptiveIcon.backgroundColor` → `#FFFFFF` (흰 배경).
