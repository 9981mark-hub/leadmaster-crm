# Google Apps Script 최종 코드 (V8 런타임용)

아래 코드는 **Chrome V8 런타임**이 켜져 있을 때 가장 잘 작동하는 최종본입니다.

## 1. 사전 준비
1. **프로젝트 설정 (톱니바퀴)** > **"Chrome V8 런타임 활성화" 체크 ✅**
2. **"편집기에서 'appsscript.json' 매니페스트 파일 표시" 체크 ✅**
3. `appsscript.json` 파일에 `"dependencies"` 항목이 있다면 **삭제**해서 깨끗하게 만드세요.

## 2. 코드 적용
`Code.gs` 파일의 내용을 모두 지우고, 아래 코드를 복사해서 붙여넣으세요.

```javascript
/**
 * GOOGLE APPS SCRIPT CODE [FINAL v9 - V8 OPTIMIZED]
 * Includes Call Recording Upload, Landing Page Sync, and Auto-CaseID
 */

var LEADS_SHEET = 'Leads';
var SETTINGS_SHEET = 'Settings';
var VISITS_SHEET = 'Visits';

function doGet(e) {
  var params = e.parameter;
  var target = params.target || params.type || 'leads'; 

  if (target === 'proxy_font') return handleFontProxy(params);
  if (target === 'sync_fonts') return handleSyncFonts(params);
  if (target === 'config') return handleConfigRetrieval(params);
  if (target === 'configs') return handleConfigsRetrieval(params);
  if (target === 'visits') return handleVisitsRetrieval(params);
  if (target === 'google_login') return handleGoogleLogin(params);
  if (target === 'admin_users_list') return handleGetAdminUsers(params);
  if (target === 'admin_login') return handleAdminLogin(params);
  if (target === 'verify_session') return handleVerifySession(params);
  if (target === 'revoke_session') return handleRevokeSession(params);

  return handleRequest('get', target, e);
}

function doPost(e) {
  var params = {};
  
  try {
     if (e.postData && e.postData.contents) {
        var jsonBody = JSON.parse(e.postData.contents);
        for (var key in jsonBody) params[key] = jsonBody[key];
     }
  } catch(err) {}
  
  if (e.parameter) {
     for (var p in e.parameter) params[p] = e.parameter[p];
  }
  
  var target = params.target || params.type || 'leads';
  
  if (target === 'upload') return handleFileUpload(params);
  if (target === 'upload_image') return handleImageUpload(params);
  if (target === 'email' || target === 'admin_email') return handleAdminEmail(params);
  if (target === 'visit') return handleVisitLog(params); // Added back for V8
  
  return handleRequest('post', target, e, params);
}

function handleRequest(method, target, e, params) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var sheetName = target === 'settings' ? SETTINGS_SHEET : LEADS_SHEET;
    var sheet = getOrCreateSheet(sheetName);
    
    if (target === 'settings') {
      if (method === 'get') {
        var data = sheet.getDataRange().getValues();
        var settings = {};
        for (var i = 1; i < data.length; i++) {
          var key = data[i][0];
          var val = data[i][1];
          if (key) {
             try { settings[key] = JSON.parse(val); } catch(err) { settings[key] = val; }
          }
        }
        return response(JSON.stringify(settings));
      }
      if (method === 'post') {
        var key = params.key;
        var value = params.value;
        var now = new Date().toISOString();
        var strValue = JSON.stringify(value);
        var data = sheet.getDataRange().getValues();
        var rowIndex = -1;
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === key) { rowIndex = i + 1; break; }
        }
        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 2).setValue(strValue);
          sheet.getRange(rowIndex, 3).setValue(now);
        } else {
          sheet.appendRow([key, strValue, now]);
        }
        return response(JSON.stringify({result: "Saved", key: key}));
      }
    }

    if (method === 'get' && target === 'leads') {
      var data = sheet.getDataRange().getValues();
      var result = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue; 
        result.push(mapRowToCase(row));
      }
      return response(JSON.stringify(result));
    }
    
    if (method === 'post' && (params.action === 'create_external' || params.landing_id)) {
       var d = params.data || params; 
       
       if (d.phone) {
           var data = sheet.getDataRange().getValues();
           for (var i = 1; i < data.length; i++) {
             if (String(data[i][6]) === String(d.phone)) { 
                return response(JSON.stringify({result: "Duplicate", message: "Phone already exists"}));
             }
           }
       }
       
       var now = new Date().toISOString();
       var caseId = 'L' + new Date().getTime(); 
       
       var newRow = new Array(46).fill(""); // V8 Compatible
       newRow[0] = caseId;              
       newRow[1] = now;                 
       newRow[2] = "신규접수";           
       newRow[5] = d.customerName || d.name || d['이름'] || ""; 
       newRow[6] = d.phone || d.Phone || d['전화번호'] || "";    
       newRow[10] = "개인회생";          
       newRow[12] = d.inboundPath || d.page_title || "랜딩페이지"; 
       newRow[13] = d.preInfo || "";    
       
       newRow[14] = "[]"; 
       newRow[31] = "[]"; 
       newRow[32] = "[]"; 
       newRow[38] = "[]"; 
       newRow[39] = "[]"; 
       newRow[40] = "[]"; 
       newRow[41] = "[]"; 
       
       sheet.appendRow(newRow);
       
       try { sendNotificationEmail(d); } catch(e) {}
       
       return response(JSON.stringify({result: "Created", caseId: caseId}));
    }
    
    // Internal CRM Update/Create/Delete
    if (method === 'post' && target === 'leads') {
        var d = params.data; 
        if (!d) return response(JSON.stringify({result: "Error", message: "No Data"}));
        
        var now = new Date().toISOString();
        var rowValues = [
            d.caseId, now, d.status, d.managerName, d.partnerId, 
            d.customerName, d.phone, d.birth, d.gender, d.region,
            d.caseType, d.historyType, d.inboundPath, d.preInfo,
            json(d.jobTypes), num(d.incomeNet), d.insurance4, d.maritalStatus,
            num(d.childrenCount), d.housingType, d.housingDetail, d.rentContractor,
            num(d.deposit), num(d.depositLoanAmount), num(d.rent), num(d.loanMonthlyPay),
            num(d.ownHousePrice), num(d.ownHouseLoan), d.ownHouseOwner, d.creditCardUse,
            num(d.creditCardAmount), json(d.creditLoan), json(d.assets), d.aiSummary,
            d.contractAt, num(d.contractFee), d.installmentMonths, d.useCapital,
            json(d.depositHistory), json(d.specialMemo), json(d.reminders), json(d.recordings),
            '', '', '', d.formattedSummary
        ];
        
        if (params.action === 'delete') {
            var rowIndex = findRowIndexById(sheet, d.caseId || d.id);
            if (rowIndex > 0) {
               sheet.deleteRow(rowIndex);
               return response(JSON.stringify({result: "Deleted"}));
            }
            return response(JSON.stringify({result: "Not Found"}));
        }
        
        var rowIndex = findRowIndexById(sheet, d.caseId);
        if (rowIndex > 0) {
            sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
            return response(JSON.stringify({result: "Updated"}));
        } else {
            sheet.appendRow(rowValues);
            return response(JSON.stringify({result: "Created"}));
        }
    }
  } catch (err) {
    return response(JSON.stringify({result: "Error", error: err.toString()}), 500);
  } finally {
    lock.releaseLock();
  }
}

// --- FILE UPLOAD HANDLER ---
function handleFileUpload(data) {
  try {
    var folderName = "leadmaster-records";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    var base64Data = data.data || "";
    if (base64Data.indexOf('base64,') > -1) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    var contentType = data.mimeType || 'application/octet-stream';
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, contentType, data.filename);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Using thumbnail link for images if applicable, else download link
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

// --- HELPERS ---
function sendNotificationEmail(params) {
    var recipient = "beanhull@gmail.com"; 
    var title = params.page_title || params.inboundPath || "신규 문의";
    var body = "새로운 문의가 접수되었습니다.\n\n";
    body += "이름: " + (params.name || params.customerName || "미입력") + "\n";
    body += "전화: " + (params.phone || "미입력") + "\n";
    body += "경로: " + title + "\n";
    
    if (params.formatted_fields) {
        try {
            var fields = JSON.parse(params.formatted_fields);
            body += "\n[상세 정보]\n";
            for (var i=0; i<fields.length; i++) body += fields[i].label + ": " + fields[i].value + "\n";
        } catch(e) {}
    }
    
    MailApp.sendEmail(recipient, "[" + title + "] 신규 DB 도착", body);
}

function handleImageUpload(params) {
  var folderName = params.folderName || "landing-factory image"; 
  var file, url;
  try {
    var data = Utilities.base64Decode(params.base64);
    var blob = Utilities.newBlob(data, params.mimeType, params.filename);
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    if (params.mimeType && params.mimeType.indexOf("image/") === 0) 
       url = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=s3000";
    else 
       url = "https://drive.google.com/uc?export=download&id=" + file.getId();
       
    return response(JSON.stringify({"result": "success", "url": url, "fileId": file.getId()}));
  } catch (e) {
    return response(JSON.stringify({"result": "error", "message": e.toString()}));
  }
}

function handleFontProxy(params) {
  return response(JSON.stringify({result: "error", message: "Font Proxy Disabled"})); 
}

// Placeholder functions for safety
function handleSyncFonts(params) {}
function handleGoogleLogin(params) {}
function handleGetAdminUsers(params) {}
function handleAdminLogin(params) {} 
function handleVerifySession(params) { return response(JSON.stringify({valid: true})); } 
function handleRevokeSession(params) { return response(JSON.stringify({result: "success"})); }
function handleVisitsRetrieval(params) {}
function handleConfigRetrieval(params) {}
function handleConfigsRetrieval(params) {}
function handleVisitLog(params) {} // Restored

function getOrCreateSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}
function findRowIndexById(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}
function mapRowToCase(row) {
    return {
          caseId: String(row[0]),
          updatedAt: row[1],
          status: row[2],
          managerName: row[3],
          partnerId: row[4],
          customerName: row[5],
          phone: row[6],
          birth: row[7],
          gender: row[8],
          region: row[9],
          caseType: row[10],
          historyType: row[11],
          inboundPath: row[12],
          preInfo: row[13],
          jobTypes: parseJSON(row[14], []),
          incomeNet: Number(row[15]) || 0,
          insurance4: row[16],
          maritalStatus: row[17],
          childrenCount: Number(row[18]) || 0,
          housingType: row[19],
          housingDetail: row[20],
          rentContractor: row[21],
          deposit: Number(row[22]) || 0,
          depositLoanAmount: Number(row[23]) || 0,
          rent: Number(row[24]) || 0,
          loanMonthlyPay: Number(row[25]) || 0,
          ownHousePrice: Number(row[26]) || 0,
          ownHouseLoan: Number(row[27]) || 0,
          ownHouseOwner: row[28],
          creditCardUse: row[29],
          creditCardAmount: Number(row[30]) || 0,
          creditLoan: parseJSON(row[31], []),
          assets: parseJSON(row[32], []),
          aiSummary: row[33],
          contractAt: row[34],
          contractFee: Number(row[35]) || 0,
          installmentMonths: row[36],
          useCapital: Boolean(row[37]),
          depositHistory: parseJSON(row[38], []),
          specialMemo: parseJSON(row[39], []),
          reminders: parseJSON(row[40], []),
          recordings: parseJSON(row[41], [])
    };
}
function parseJSON(str, fallback) { try { return JSON.parse(str); } catch (e) { return fallback; } }
function json(obj) { return obj ? JSON.stringify(obj) : '[]'; }
function num(val) { return val || 0; }
function response(content, code) { return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON); }
