/**
 * ============================================
 * 이메일 리마인더 알림 기능 - Google Apps Script 추가 코드
 * ============================================
 * 
 * 아래 코드를 기존 Google Apps Script(Code.gs)의 맨 아래에 추가하세요.
 * 
 * 설정 방법:
 * 1. script.google.com에서 프로젝트 열기
 * 2. 아래 코드를 기존 코드 맨 아래에 붙여넣기
 * 3. 저장 후 배포 → 새 배포 (또는 기존 배포 업데이트)
 * 4. 트리거 설정: 편집 → 현재 프로젝트 트리거 → 트리거 추가
 *    - 함수 선택: checkAndSendReminderEmails
 *    - 이벤트 소스: 시간 기반
 *    - 트리거 유형: 분 단위
 *    - 간격: 5분마다
 */

// ============================================
// 이메일 알림 관련 함수
// ============================================

/**
 * 리마인더 이메일 발송 체크 (트리거로 5분마다 실행)
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
      if (!row[0]) continue; // caseId 없으면 스킵
      
      var caseId = String(row[0]);
      var customerName = row[5] || 'Unknown';
      var phone = row[6] || '';
      var remindersJson = row[40]; // reminders 컬럼
      
      var reminders = [];
      try {
        reminders = JSON.parse(remindersJson || '[]');
      } catch(e) {
        continue;
      }
      
      if (!Array.isArray(reminders)) continue;
      
      for (var j = 0; j < reminders.length; j++) {
        var r = reminders[j];
        if (!r.datetime || r.resultStatus) continue; // 완료된 리마인더 스킵
        
        // 날짜 파싱 (yyyy-MM-dd HH:mm 형식)
        var reminderDate = parseReminderDate(r.datetime);
        if (!reminderDate) continue;
        
        var diffMs = reminderDate.getTime() - now.getTime();
        var diffMinutes = diffMs / (1000 * 60);
        
        // 알림 시간 범위 체크 (설정값 ± 3분)
        if (diffMinutes >= (minutesBefore - 3) && diffMinutes <= (minutesBefore + 3)) {
          var uniqueId = caseId + '_' + r.id + '_' + r.datetime;
          
          // 중복 체크
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
        
        // 발송 기록 저장
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
    // "2026-01-19 14:30" 형식
    var parts = dateStr.split(' ');
    if (parts.length < 2) return null;
    
    var dateParts = parts[0].split('-');
    var timeParts = parts[1].split(':');
    
    if (dateParts.length < 3 || timeParts.length < 2) return null;
    
    return new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1, // 월은 0부터 시작
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
    console.log('수신자가 설정되어 있지 않습니다.');
  }
}
