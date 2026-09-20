# 사진 폴더

- 여행별 폴더: `photos/<여행 ID>/` (여행 ID는 사이트 주소 `#/trip/<여기>` 부분)
- github.com 에서 이 폴더로 들어가 "Add file → Upload files"로 올린다.
- 사이트의 장소 편집 시트에서 파일명(예: `01.jpg`)만 적으면 표시된다.
- 여행 대표 사진은 같은 폴더에 올린 뒤 Firestore `trips/<id>.coverPhoto`에 파일명을 넣는다.
