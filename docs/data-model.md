# 데이터 구조 (Firestore)

2026-09-23 기준. 보안 규칙(`firestore.rules`)은 여기 적힌 필드만 저장을 허용한다.
**문서에 새 필드를 쓰게 되면 규칙의 해당 `hasOnly` 목록과 `tests-rules/` 도 함께 고치고 `npm run deploy:rules` 로 게시해야 한다.**
안 하면 그 저장은 `permission-denied` 로 막힌다.

## 최상위

| 경로 | 필드 | 쓰는 사람 |
|---|---|---|
| `allowedUsers/{email}` | `invitedAt`, `invitedBy`(uid), `canCreate`(bool, 여행 만들기) | 사이트 주인. 여행 만들기가 켜진 계정은 동행 초대용으로 추가만 (canCreate 는 못 켬) |
| `profiles/{email}` | `uid`, `nickname`(20자), `photoURL`(googleusercontent 만), `updatedAt` | 초대받은 본인 |
| `trips/{tripId}` | `title`(100자), `startDate`·`endDate`(YYYY-MM-DD), `ownerUid`, `ownerEmail`, `memberEmails`(30명), `createdAt`, `cover`(Bytes, 210 KiB, 대표 사진), `coverPhoto`(예전 방식 파일명), `rates`(통화→원화 환율) | 만들기: 사이트 주인·여행 만들기 켜진 계정. 고치기: 멤버 (동행 목록은 주인만, 주인·만든 날은 못 바꿈) |

## 여행 안 (`trips/{tripId}/...`, 멤버만)

| 모음 | 필드 | 메모 |
|---|---|---|
| `days` | `date`, `order` | 여행 기간과 함께 움직인다 |
| `places` | `name`, `time`(HH:MM), `stayMinutes`, `category`, `memo`, `lat`, `lng`, `address`, `placeId`(Google), `dayId`(null 이거나 지워진 Day 면 보관함), `order`, `photoCount`, `photos`(예전 파일명), `routeToNext` | `category: 'note'` 는 메모 항목. `routeToNext` 는 다음 장소까지 도보 경로 `{ key, encoded, meters, seconds, at }` 또는 경로 없음 `{ key, none: true, at }` (30일) |
| `photos` | `placeId`, `data`(Bytes, 720 KiB), `width`, `height`, `size`, `createdAt` | 긴 변 1280px JPEG. `size` 는 바이트 길이(규칙이 실제 길이와 같은지 검사) — 저장 용량을 사진을 내려받지 않고 서버 합계로 어림한다. 예전 사진엔 없고, 용량 계산 때 한 번 채운다 |
| `checklist` | `group`, `groupOrder`, `order`, `text`, `done` | 그룹은 이름으로 묶는다 |
| `reservations` | `type`(flight·stay·food·etc…), `title`, `datetime`, `arrival`(항공 도착), `checkout`(숙소), `code`, `note`, `flightNumber`, `fromAirport`, `toAirport`, `linkedPlaceIds`, `linkedPlaceId`, `files`(서류 메타 `{ id, name, type, size }`) | 연결의 기준은 `linkedPlaceIds`(숙소 여러 박이면 여러 개). `linkedPlaceId` 는 첫 연결과 같게 두는 예전 호환 필드 (`js/lib/reservation-links.js`) |
| `expenses` | `title`, `amount`, `currency`, `category`, `date`, `paidBy`, `sharedWith`, `note`, `createdAt` | `sharedWith` 는 늘 명시해 저장한다. 비어 있는 예전 지출만 "지금 동행 전원"으로 계산 (`js/lib/expenses.js`) |
| `files` | `reservationId`, `name`, `type`(PDF·JPEG 만), `size`, `data`(Bytes, 950 KiB), `createdAt` | 예약 서류 본문. 열 때 형식은 `js/lib/file-type.js` 로 다시 거른다 |

## 지켜야 할 것

- 쓰기는 `js/db.js` 한 곳에서만. 서버 확인은 1초만 기다리고 넘어간다(오프라인 저장, `js/lib/settle.js`).
- 문서 하나는 1 MiB 를 넘을 수 없다. 사진·서류를 문서에 직접 넣으므로 크기 상한을 규칙과 앱(`js/photo.js`, `FILE_MAX_BYTES`)이 함께 지킨다.
- 무료 저장 공간은 1 GiB. 사진이 가장 먼저 채운다 (사용량 창에서 추정치 확인).
