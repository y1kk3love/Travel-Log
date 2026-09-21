# 안드로이드 서명 키

- 파일: `~/travel-log-release.keystore` (저장소 밖, 커밋 금지), 별칭 `travel-log`
- 이 키로 서명한 APK 만 기존 설치 위에 업데이트할 수 있다. 키를 잃으면 사용자가 앱을 지우고 다시 설치해야 한다.
- 백업: 키 파일과 비밀번호를 비밀번호 관리자 또는 외부 드라이브에 따로 보관한다.
- GitHub Secrets: `ANDROID_KEYSTORE_BASE64`(파일 base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`(=travel-log), `ANDROID_KEY_PASSWORD`
- SHA-1 지문은 Firebase 콘솔(안드로이드 앱)에 등록되어 있다. 키를 바꾸면 지문도 다시 등록한다.

## 키 만들기 (한 번)

JDK 17 (Temurin) 이 설치되어 있어야 한다. PowerShell 에서:

```powershell
keytool -genkeypair -v -keystore "$HOME\travel-log-release.keystore" -alias travel-log -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Travel Log, OU=y1kk3love, O=y1kk3love, L=Seoul, C=KR"
```

비밀번호를 물으면 직접 정한 값을 넣는다(키 비밀번호는 저장소 비밀번호와 같게 두면 편하다).

지문 확인:

```powershell
keytool -list -v -keystore "$HOME\travel-log-release.keystore" -alias travel-log
```

`SHA1:` 과 `SHA256:` 줄을 Firebase 콘솔 → 프로젝트 설정 → 안드로이드 앱 → 디지털 지문에 등록한다.

## GitHub Secrets 넣기

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\travel-log-release.keystore")) | Set-Clipboard
```

저장소 → Settings → Secrets and variables → Actions → New repository secret:
`ANDROID_KEYSTORE_BASE64`(클립보드 내용), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` = `travel-log`, `ANDROID_KEY_PASSWORD`.
