/**
 * GOOGLE APPS SCRIPT CODE [FINAL v10 - WITH EMAIL REMINDER]
 * Includes Call Recording Upload, Landing Page Sync, Auto-CaseID, and Email Reminder Notifications
 * 
 * ============================================
 * 설치 방법:
 * 1. script.google.com에서 기존 Code.gs 파일 전체 삭제
 * 2. 이 코드 전체를 붙여넣기
 * 3. 저장 → 배포 → 새 배포
 * 4. 트리거 설정: checkAndSendReminderEmails 함수를 5분마다 실행
 * ============================================
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
  if (target === 'visit') return handleVisitLog(params);
  
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
       
       var newRow = new Array(50).fill("");
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
       newRow[43] = now; 
       
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
            d.isViewed, d.createdAt, num(d.missedCallCount), d.lastMissedCallAt, d.formattedSummary
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

// Placeholder functions
function handleSyncFonts(params) {}
function handleGoogleLogin(params) {}
function handleGetAdminUsers(params) {}
function handleAdminLogin(params) {} 
function handleVerifySession(params) { return response(JSON.stringify({valid: true})); } 
function handleRevokeSession(params) { return response(JSON.stringify({result: "success"})); }
function handleVisitsRetrieval(params) {}
function handleConfigRetrieval(params) {}
function handleConfigsRetrieval(params) {}
function handleVisitLog(params) {}
function handleAdminEmail(params) {}

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
          createdAt: row[43] || row[1],
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
          recordings: parseJSON(row[41], []),
          isViewed: Boolean(row[42]),
          missedCallCount: Number(row[44]) || 0,
          lastMissedCallAt: row[45]
    };
}

function parseJSON(str, fallback) { try { return JSON.parse(str); } catch (e) { return fallback; } }
function json(obj) { return obj ? JSON.stringify(obj) : '[]'; }
function num(val) { return val || 0; }
function response(content, code) { return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON); }

// [권한 강제 승인용 함수]
function testDriveWrite() {
  var folder = DriveApp.getRootFolder();
  folder.createFile("권한테스트_" + new Date().toISOString() + ".txt", "권한이 정상입니다.");
  console.log("✅ 드라이브 쓰기 권한 확인 완료!");
}


// ============================================
// 📧 이메일 리마인더 알림 기능
// ============================================

/**
 * 리마인더 이메일 발송 체크 (트리거로 5분마다 실행)
 * 
 * 트리거 설정 방법:
 * 1. Apps Script 편집기 → 트리거 (시계 아이콘)
 * 2. + 트리거 추가
 * 3. 함수: checkAndSendReminderEmails
 * 4. 이벤트 소스: 시간 기반
 * 5. 유형: 분 단위, 5분마다
 */
function checkAndSendReminderEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    console.log('다른 프로세스가 실행 중입니다.');
    return;
  }
  
  try {
    // 1. Settings에서 이메일 알림 설정 로드
    var settings = getEmailNotificationSettings();
    
    if (!settings.enabled) {
      console.log('이메일 알림이 비활성화되어 있습니다.');
      return;
    }
    
    if (!settings.recipients || settings.recipients.length === 0) {
      console.log('수신자가 없습니다.');
      return;
    }
    
    var minutesBefore = settings.minutesBefore || 10;
    
    // 2. 발송 기록 로드 (중복 방지)
    var sentLog = getSentEmailLog();
    
    // 3. Leads 시트에서 리마인더 확인
    var sheet = getOrCreateSheet(LEADS_SHEET);
    var data = sheet.getDataRange().getValues();
    
    var now = new Date();
    var remindersToSend = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      
      var caseId = String(row[0]);
      var customerName = row[5] || 'Unknown';
      var phone = row[6] || '';
      var remindersJson = row[40];
      
      var reminders = [];
      try {
        reminders = JSON.parse(remindersJson || '[]');
      } catch(e) {
        continue;
      }
      
      if (!Array.isArray(reminders)) continue;
      
      for (var j = 0; j < reminders.length; j++) {
        var r = reminders[j];
        if (!r.datetime || r.resultStatus) continue;
        
        var reminderDate = parseReminderDate(r.datetime);
        if (!reminderDate) continue;
        
        var diffMs = reminderDate.getTime() - now.getTime();
        var diffMinutes = diffMs / (1000 * 60);
        
        // 알림 시간 범위 체크 (설정값 ± 3분)
        if (diffMinutes >= (minutesBefore - 3) && diffMinutes <= (minutesBefore + 3)) {
          var uniqueId = caseId + '_' + r.id + '_' + r.datetime;
          
          if (sentLog.indexOf(uniqueId) === -1) {
            remindersToSend.push({
              uniqueId: uniqueId,
              caseId: caseId,
              customerName: customerName,
              phone: phone,
              reminder: r,
              minutesLeft: Math.round(diffMinutes)
            });
          }
        }
      }
    }
    
    // 4. 이메일 발송
    for (var k = 0; k < remindersToSend.length; k++) {
      var item = remindersToSend[k];
      
      try {
        sendReminderEmailToAll(settings.recipients, item);
        sentLog.push(item.uniqueId);
        console.log('이메일 발송 완료: ' + item.customerName + ' (' + item.reminder.datetime + ')');
      } catch(e) {
        console.error('이메일 발송 실패: ' + e.toString());
      }
    }
    
    // 5. 발송 기록 저장 (최근 500건만 유지)
    if (sentLog.length > 500) {
      sentLog = sentLog.slice(-500);
    }
    saveSentEmailLog(sentLog);
    
    console.log('총 ' + remindersToSend.length + '건의 이메일 발송 완료');
    
  } catch(e) {
    console.error('checkAndSendReminderEmails 오류: ' + e.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * 리마인더 이메일 발송
 */
function sendReminderEmailToAll(recipients, item) {
  var subject = '📅 [LeadMaster] 리마인더 알림 - ' + item.customerName + ' (' + item.minutesLeft + '분 전)';
  
  var body = '안녕하세요!\n\n';
  body += '예정된 리마인더가 곧 시작됩니다.\n\n';
  body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  body += '📌 고객명: ' + item.customerName + '\n';
  body += '📞 연락처: ' + item.phone + '\n';
  body += '📅 일시: ' + item.reminder.datetime + '\n';
  body += '🏷️ 유형: ' + (item.reminder.type || '통화') + '\n';
  body += '📝 내용: ' + (item.reminder.content || '내용 없음') + '\n\n';
  body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  body += '케이스 ID: ' + item.caseId + '\n\n';
  body += '이 메일은 LeadMaster CRM에서 자동 발송되었습니다.';
  
  // HTML 버전
  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  htmlBody += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">';
  htmlBody += '<h1 style="color: white; margin: 0; font-size: 20px;">📅 리마인더 알림</h1>';
  htmlBody += '</div>';
  htmlBody += '<div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">';
  htmlBody += '<p style="color: #666; margin-top: 0;">예정된 리마인더가 <strong style="color: #e74c3c;">' + item.minutesLeft + '분 후</strong> 시작됩니다.</p>';
  htmlBody += '<div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">';
  htmlBody += '<table style="width: 100%; border-collapse: collapse;">';
  htmlBody += '<tr><td style="padding: 8px 0; color: #888;">고객명</td><td style="padding: 8px 0; font-weight: bold;">' + item.customerName + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #888;">연락처</td><td style="padding: 8px 0;"><a href="tel:' + item.phone + '" style="color: #667eea;">' + item.phone + '</a></td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #888;">일시</td><td style="padding: 8px 0;">' + item.reminder.datetime + '</td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #888;">유형</td><td style="padding: 8px 0;"><span style="background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 12px; font-size: 12px;">' + (item.reminder.type || '통화') + '</span></td></tr>';
  htmlBody += '<tr><td style="padding: 8px 0; color: #888;">내용</td><td style="padding: 8px 0;">' + (item.reminder.content || '내용 없음') + '</td></tr>';
  htmlBody += '</table>';
  htmlBody += '</div>';
  htmlBody += '</div>';
  htmlBody += '<div style="background: #2c3e50; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">';
  htmlBody += '<p style="color: #95a5a6; margin: 0; font-size: 12px;">LeadMaster CRM 자동 알림</p>';
  htmlBody += '</div>';
  htmlBody += '</div>';
  
  for (var i = 0; i < recipients.length; i++) {
    MailApp.sendEmail({
      to: recipients[i],
      subject: subject,
      body: body,
      htmlBody: htmlBody
    });
  }
}

/**
 * 이메일 알림 설정 조회
 */
function getEmailNotificationSettings() {
  var sheet = getOrCreateSheet(SETTINGS_SHEET);
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'emailNotificationSettings') {
      try {
        return JSON.parse(data[i][1]);
      } catch(e) {
        return { enabled: false, recipients: [], minutesBefore: 10 };
      }
    }
  }
  
  return { enabled: false, recipients: [], minutesBefore: 10 };
}

/**
 * 발송 기록 조회
 */
function getSentEmailLog() {
  var sheet = getOrCreateSheet(SETTINGS_SHEET);
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'emailSentLog') {
      try {
        return JSON.parse(data[i][1]) || [];
      } catch(e) {
        return [];
      }
    }
  }
  
  return [];
}

/**
 * 발송 기록 저장
 */
function saveSentEmailLog(log) {
  var sheet = getOrCreateSheet(SETTINGS_SHEET);
  var data = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var strValue = JSON.stringify(log);
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'emailSentLog') {
      sheet.getRange(i + 1, 2).setValue(strValue);
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  
  sheet.appendRow(['emailSentLog', strValue, now]);
}

/**
 * 리마인더 날짜 파싱 (yyyy-MM-dd HH:mm)
 */
function parseReminderDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    var parts = dateStr.split(' ');
    if (parts.length < 2) return null;
    
    var dateParts = parts[0].split('-');
    var timeParts = parts[1].split(':');
    
    if (dateParts.length < 3 || timeParts.length < 2) return null;
    
    return new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeParts[0]),
      parseInt(timeParts[1])
    );
  } catch(e) {
    return null;
  }
}

/**
 * 테스트용: 이메일 발송 테스트
 */
function testSendEmail() {
  var settings = getEmailNotificationSettings();
  console.log('현재 설정:', JSON.stringify(settings));
  
  if (settings.recipients && settings.recipients.length > 0) {
    var testItem = {
      uniqueId: 'TEST_' + new Date().getTime(),
      caseId: 'TEST001',
      customerName: '테스트 고객',
      phone: '010-1234-5678',
      reminder: {
        datetime: new Date().toISOString().slice(0, 16).replace('T', ' '),
        type: '통화',
        content: '이것은 테스트 이메일입니다.'
      },
      minutesLeft: 10
    };
    
    sendReminderEmailToAll(settings.recipients, testItem);
    console.log('테스트 이메일 발송 완료!');
  } else {
    console.log('수신자가 설정되어 있지 않습니다. Settings 페이지에서 먼저 이메일을 등록해주세요.');
  }
}
