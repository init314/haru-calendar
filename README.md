# 하루 캘린더

Google MCP 서버를 사용하는 Windows 캘린더입니다. 월간 달력에서 날짜를 선택하고, 오른쪽 일정의 원을 클릭하면 취소선과 함께 완료 목록 아래로 이동합니다. 다시 클릭하면 복원합니다.

## 설치

`release/Haru-Calendar-Setup-1.0.0.exe`를 실행하세요. 사용자 계정에 설치하며 바탕화면 바로가기를 만듭니다.

## Google 연결

이 PC의 `~/.codex/config.toml` 또는 `CODEX_HOME/config.toml`에서 `home_google_drive` MCP 서버 설정을 읽습니다. 앱 자체가 MCP 클라이언트로 연결하므로 Codex 대화를 열어둘 필요가 없습니다. SSH, 키 파일, 네트워크 및 원격 MCP 서버는 기존 설정대로 사용합니다. 인증 토큰이나 개인 키를 설치 파일에 포함하지 않습니다.

기존 서버의 기본 계정 / `primary` 캘린더를 사용합니다. 여러 캘린더 선택은 현재 지원하지 않습니다. 앱 실행 시, 월 이동 시, 5분마다 일정을 동기화하며 새로고침 버튼으로 수동 실행할 수도 있습니다. `calendar.events` 권한만 사용하므로 캘린더 목록 조회 권한이 없어도 동작합니다.

집 PC의 서버와 네트워크가 켜져 있어야 새로 동기화할 수 있습니다. 다른 PC에서는 해당 MCP 설정과 SSH 연결을 먼저 구성해야 합니다.

## 일정 관리

- Google 일정 및 반복 일정의 개별 회차를 불러옵니다. 여러 날에 걸친 일정도 해당 날짜마다 표시합니다.
- `[LMS]` 일정은 동기화할 때 Google 원본도 마감일 하루짜리 일정으로 자동 정리합니다. 새 LMS 일정이 올라오면 다음 동기화 때 같은 규칙이 적용됩니다.
- 새 일정은 로컬 또는 Google 기본 캘린더에 저장합니다. 시간 생략 시 종일, 시간 지정 시 1시간 일정입니다.
- 완료 상태는 이 PC에만 저장합니다. Google 원본 제목을 변경하지 않으며 다른 PC와 완료 체크를 공유하지 않습니다.
- Google 일정 제목을 누르면 브라우저에서 원본을 열어 편집할 수 있습니다.
- 로컬 일정은 카드의 × 버튼으로 삭제합니다.
- 연결이 끊기면 마지막으로 동기화한 월의 일정과 완료 체크를 계속 사용할 수 있습니다.

데이터 위치: `%APPDATA%/haru-calendar/calendar.json`. 백업하려면 앱을 종료하고 해당 파일을 복사하세요. 제거 후에도 사용자 데이터는 남습니다.

## 개발

Node.js 22.12 이상이 필요합니다.

```powershell
npm ci
npx install-electron
npm start
npm test
node tests/ui-smoke.cjs
npm run dist
```

개발 시 이 폴더의 `.tools/node_modules/node/bin/node.exe`로 설치된 Node.js 22를 사용할 수 있습니다. Windows 설치 파일은 NSIS로 생성되며 코드 서명은 적용하지 않았습니다.

구현 참고: [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/client), [Electron 보안](https://www.electronjs.org/docs/latest/tutorial/security).
