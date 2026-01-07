# Google Apps Script 업데이트 가이드 (음성 파일 동기화)

모바일/PC 간 음성 파일을 동기화하기 위해, **구글 드라이브 업로드 기능**을 Apps Script 백엔드에 추가해야 합니다.

## 1. Apps Script 열기
1. 구글 스프레드시트에서 **확장 프로그램** > **Apps Script**를 선택하세요.
2. `Code.gs` (또는 `코드.gs`) 파일을 엽니다.

## 2. 코드 수정하기
기존 `doPost` 함수 내부에 **`target === 'upload'`**인 경우를 처리하는 로직을 추가하고, 파일 업로드를 처리하는 `handleFileUpload` 함수를 아래에 붙여넣으세요.

### (1) `doPost` 함수 수정
기존 `doPost` 함수 안에서 `JSON.parse` 하는 부분 바로 뒤에 아래 코드를 추가합니다.

```javascript
function doPost(e) {
  // ... (기존 설정 코드) ...
  
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON' })).setMimeType(ContentService.MimeType.JSON);
  }

  // ▼▼▼ [추가할 부분 시작] ▼▼▼
  if (data.target === 'upload') {
    return handleFileUpload(data);
  }
  // ▲▲▲ [추가할 부분 끝] ▲▲▲

  // ... (기존 로직: create, update 등) ...
}
```

### (2) `handleFileUpload` 함수 추가
파일의 맨 아래에 다음 함수를 그대로 복사해서 붙여넣으세요.

```javascript
function handleFileUpload(data) {
  try {
    // 1. 저장할 폴더 지정 (없으면 생성)
    var folderName = "leadmaster-records";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // 2. Base64 디코딩 및 Blob 생성
    // 데이터가 "data:audio/mp3;base64,..." 형식의 헤더를 포함할 수 있으므로 제거
    var base64Data = data.data;
    if (base64Data.indexOf('base64,') > -1) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    var contentType = data.mimeType || 'application/octet-stream';
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, contentType, data.filename);
    
    // 3. 파일 생성
    var file = folder.createFile(blob);
    
    // 4. 권한 설정 (링크가 있는 모든 사용자가 재생 가능하게 설정)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // 5. 재생 가능한 직접 링크 생성
    // Google Drive의 직접 재생을 위한 트릭 URL 사용
    var downloadUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      url: downloadUrl,
      id: file.getId(),
      viewUrl: file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. 배포 업데이트 (중요!)
코드를 상단 **저장(💾)** 버튼을 누른 후, 우측 상단 **배포** > **새 배포(New Deployment)** > **배포(Deploy)**를 눌러 변경사항을 반영해야 합니다. 
(이미 배포된 URL을 그대로 쓰더라도 '새 버전'으로 업데이트해줘야 코드가 반영됩니다.)

---
**주의:** 업로드 가능한 파일 크기는 Apps Script 제한(약 50MB)을 따릅니다. 10MB 내외의 통화 녹음 파일은 문제없이 업로드됩니다.
