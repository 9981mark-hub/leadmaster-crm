import os
import json
import base64

def generate_player():
    metadata_path = 'colab_cosyvoice_pack/voices_metadata.json'
    with open(metadata_path, 'r', encoding='utf-8') as f:
        profiles = json.load(f)

    voice_details = {
        'p01_20s_male': {
            'tag': '20대 남성 (비중 5%)',
            'badge_class': 'badge-cyan',
            'desc': '취준생 / 코인·생활비 대출 / 젊고 당황스러운 톤, 출처 경계'
        },
        'p02_30s_female': {
            'tag': '30대 여성 (비중 15%)',
            'badge_class': 'badge-pink',
            'desc': '직장인 / 전세사기 및 카드 돌려막기 / 근무 중 조심스럽고 빠른 말투'
        },
        'p03_40s_male_rush': {
            'tag': '40대 남성 (비중 30%) · 결론재촉',
            'badge_class': 'badge-amber',
            'desc': '자영업자 / 거래처 어음 / 바쁘고 성격 급함, 용건만 묻는 단도직입'
        },
        'p04_40s_female_skeptic': {
            'tag': '40대 여성 (비중 30%) · 의심경계',
            'badge_class': 'badge-red',
            'desc': '주부 / 스팸 의심 / 앙칼진 톤으로 출처를 강하게 추궁하는 Cold DB 전형'
        },
        'p05_40s_male_inquirer': {
            'tag': '40대 남성 (비중 30%) · 꼼꼼질문',
            'badge_class': 'badge-blue',
            'desc': '직장인 / 다중채무 / 카드 정지 여부와 가족 연락을 꼼꼼히 따지는 신중형'
        },
        'p06_50s_male_story': {
            'tag': '50대 남성 (비중 30%) · 신세한탄',
            'badge_class': 'badge-purple',
            'desc': '식당 폐업 / 사채 돌려막기 / 깊은 한숨과 눈물 섞인 긴 사연 하소연'
        },
        'p07_50s_male_heavy': {
            'tag': '50대 남성 (비중 30%) · 법인대표',
            'badge_class': 'badge-emerald',
            'desc': '중소기업 대표 / 법인 연대보증 / 중후하고 차분하며 법적 쟁점을 묻는 톤'
        },
        'p08_50s_female_anxious': {
            'tag': '50대 여성 (비중 30%) · 시름불안',
            'badge_class': 'badge-rose',
            'desc': '가정주부 / 병간호 채무 / 가압류 딱지에 공포를 느끼며 떨리는 목소리'
        },
        'p09_60s_male_elder': {
            'tag': '60대 남성 (비중 15%) · 노년경비',
            'badge_class': 'badge-orange',
            'desc': '노년층 경비원 / 독촉 스트레스 / 가는귀 먹어 목소리가 크고 투박한 어르신'
        },
        'p10_70s_female_elder': {
            'tag': '70대 여성 (비중 5%) · 독거파산',
            'badge_class': 'badge-slate',
            'desc': '독거노인 / 기초수급 / 기운 없고 느린 호흡의 70대 할머니 파산 면책 음성'
        }
    }

    cards_html = []
    for idx, p in enumerate(profiles, 1):
        vid = p['voice_id']
        wav_path = os.path.join('colab_cosyvoice_pack/ref_voices', p['ref_file'])
        with open(wav_path, 'rb') as wf:
            b64_data = base64.b64encode(wf.read()).decode('utf-8')
        data_uri = f'data:audio/wav;base64,{b64_data}'
        
        details = voice_details.get(vid, {'tag': p['age_group'], 'badge_class': 'badge-blue', 'desc': ''})
        
        card = f'''
      <div class="card" id="card_{vid}">
        <div class="card-header">
          <div class="card-title">🎙️ {idx}. {p['name']}</div>
          <span class="tag {details['badge_class']}">{details['tag']}</span>
        </div>
        <div class="desc-row">{details['desc']}</div>
        <div class="quote">"{p['prompt_text']}"</div>
        
        <div class="btn-row">
          <button class="big-play-btn" id="btn_{vid}" onclick="toggleAudio('{vid}')">
            <span class="icon">▶</span> <span class="txt">실제 성대 목소리 듣기</span>
          </button>
        </div>

        <audio id="audio_{vid}" controls preload="auto" src="{data_uri}"></audio>
      </div>
        '''
        cards_html.append(card)

    cards_joined = "\n".join(cards_html)

    html_content = f'''<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2안. CosyVoice 2 실제 녹취 100% 복제 10인 보이스 플레이어</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
      background: #090d16;
      color: #f8fafc;
      padding: 30px 16px;
      margin: 0;
      display: flex;
      justify-content: center;
    }}
    .container {{
      max-width: 680px;
      width: 100%;
      background: #111827;
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      border: 1px solid #1f2937;
    }}
    .nav-bar {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .badge {{
      display: inline-block;
      padding: 6px 14px;
      background: rgba(168, 85, 247, 0.2);
      color: #c084fc;
      font-size: 13px;
      font-weight: 700;
      border-radius: 9999px;
      border: 1px solid rgba(168, 85, 247, 0.4);
    }}
    .switch-link {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #1e293b;
      color: #38bdf8;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      border: 1px solid #334155;
      transition: all 0.2s;
    }}
    .switch-link:hover {{
      background: #334155;
      color: #7dd3fc;
    }}
    h1 {{
      font-size: 23px;
      font-weight: 800;
      margin: 0 0 10px 0;
      color: #ffffff;
      line-height: 1.3;
    }}
    p.sub {{
      font-size: 13.5px;
      color: #9ca3af;
      margin: 0 0 24px 0;
      line-height: 1.6;
    }}
    .info-box {{
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid #334155;
      border-left: 4px solid #a855f7;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }}
    .card {{
      background: #0f172a;
      border: 2px solid #1e293b;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 18px;
      transition: all 0.2s;
    }}
    .card:hover {{
      border-color: #a855f7;
    }}
    .card.playing {{
      border-color: #c084fc;
      background: #171c2e;
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.25);
    }}
    .card-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 6px;
    }}
    .card-title {{
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
    }}
    .tag {{
      display: inline-block;
      font-size: 11.5px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
    }}
    .badge-cyan {{ background: rgba(6, 182, 212, 0.2); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.4); }}
    .badge-pink {{ background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4); }}
    .badge-amber {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }}
    .badge-red {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }}
    .badge-blue {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }}
    .badge-purple {{ background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); }}
    .badge-emerald {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }}
    .badge-rose {{ background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4); }}
    .badge-orange {{ background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.4); }}
    .badge-slate {{ background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4); }}
    
    .desc-row {{
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 12px;
      line-height: 1.4;
    }}
    .quote {{
      background: #1e293b;
      padding: 12px 14px;
      border-radius: 10px;
      color: #e2e8f0;
      font-size: 13.5px;
      line-height: 1.5;
      margin-bottom: 14px;
      border-left: 3px solid #8b5cf6;
    }}
    .btn-row {{
      margin-bottom: 10px;
    }}
    .big-play-btn {{
      width: 100%;
      background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
      color: #ffffff;
      border: none;
      padding: 13px 18px;
      border-radius: 12px;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
    }}
    .big-play-btn:hover {{
      background: linear-gradient(135deg, #6d28d9 0%, #7e22ce 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
    }}
    .big-play-btn:active {{
      transform: translateY(1px);
    }}
    .big-play-btn.playing {{
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
    }}
    audio {{
      width: 100%;
      height: 36px;
      margin-top: 6px;
      opacity: 0.85;
    }}
    .compare-card {{
      background: #1e293b;
      border-radius: 16px;
      padding: 22px;
      margin-top: 30px;
      border: 1px solid #334155;
    }}
    .compare-title {{
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 12px;
    }}
    .compare-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      margin-top: 10px;
    }}
    .compare-table th, .compare-table td {{
      padding: 10px 12px;
      border: 1px solid #334155;
      text-align: left;
    }}
    .compare-table th {{
      background: #0f172a;
      color: #94a3b8;
    }}
    .compare-table td {{
      color: #e2e8f0;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="nav-bar">
      <div class="badge">🎙️ 2안. CosyVoice 2 실제 녹취 복제</div>
      <a href="/edge_tts_samples/index.html" class="switch-link">
        <span>🔊</span> 1안 Edge-TTS 플레이어 보기 ↗
      </a>
    </div>

    <h1>실전 통화 녹취 100% 복제 10인 목소리</h1>
    <p class="sub">실제 개인회생·파산 상담 통화 녹취에서 추출한 20대~70대 연령대별 실전 성대(음색·호흡·억양)를 CosyVoice 2가 100% 동일하게 복제하여 발화합니다. 아래 재생 버튼을 눌러 들어보세요.</p>

    <div class="info-box">
      <strong>⚡ CosyVoice 2 복제 원리:</strong><br>
      우리 CRM이 제공하는 <code>colab_cosyvoice_pack</code>을 구글 Colab(무료 GPU)에서 실행하면, 아래 10명의 실제 사람 성대 주파수와 억양을 즉시 학습하여 AI 가상 고객의 모든 대사를 <strong>진짜 사람 통화 녹취와 구별 불가능한 음성</strong>으로 말하게 됩니다.
    </div>

    {cards_joined}

    <div class="compare-card">
      <div class="compare-title">⚖️ 1안 vs 2안 핵심 비교 요약</div>
      <table class="compare-table">
        <thead>
          <tr>
            <th>구분</th>
            <th>1안. Edge-TTS 직결</th>
            <th>2안. CosyVoice 2 실제 복제</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>음질·리얼리티</strong></td>
            <td>실전 성우급 고품질 뉴럴 음성 (사투리/호흡 세밀 튜닝)</td>
            <td><strong>실제 통화 녹취 100% 동일</strong> (진짜 사람 성대·억양 복제)</td>
          </tr>
          <tr>
            <td><strong>구동 편의성</strong></td>
            <td><strong>별도 설정 없이 즉시 발화 (0원 무제한)</strong></td>
            <td>훈련 시작 시 Colab 재생 버튼 1회 클릭 필요</td>
          </tr>
          <tr>
            <td><strong>응답 지연(레이턴시)</strong></td>
            <td><strong>0.3~0.5초 초고속</strong> (실시간 티키타카)</td>
            <td>1.5~2.5초 (GPU 연산 후 스트리밍)</td>
          </tr>
          <tr>
            <td><strong>도입 추천</strong></td>
            <td><strong>상담원 전원 일상 트레이닝용 기본값</strong></td>
            <td><strong>주 1회 극한 실전 모의고사/고난도 훈련용</strong></td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top: 14px; text-align: center;">
        <a href="/edge_tts_samples/index.html" style="color: #60a5fa; font-size: 13px; text-decoration: underline;">
          👉 1안 Edge-TTS 샘플 목소리도 함께 비교해서 들어보기
        </a>
      </div>
    </div>
  </div>

  <script>
    let currentPlayingId = null;

    function toggleAudio(voiceId) {{
      const audio = document.getElementById('audio_' + voiceId);
      const btn = document.getElementById('btn_' + voiceId);
      const card = document.getElementById('card_' + voiceId);

      if (!audio) return;

      // 이미 재생 중인 다른 오디오가 있다면 정지
      if (currentPlayingId && currentPlayingId !== voiceId) {{
        const prevAudio = document.getElementById('audio_' + currentPlayingId);
        const prevBtn = document.getElementById('btn_' + currentPlayingId);
        const prevCard = document.getElementById('card_' + currentPlayingId);
        if (prevAudio) {{
          prevAudio.pause();
          prevAudio.currentTime = 0;
        }}
        if (prevBtn) {{
          prevBtn.classList.remove('playing');
          prevBtn.querySelector('.icon').innerText = '▶';
          prevBtn.querySelector('.txt').innerText = '실제 성대 목소리 듣기';
        }}
        if (prevCard) {{
          prevCard.classList.remove('playing');
        }}
        currentPlayingId = null;
      }}

      // 현재 오디오 토글
      if (audio.paused) {{
        audio.play().then(() => {{
          currentPlayingId = voiceId;
          btn.classList.add('playing');
          btn.querySelector('.icon').innerText = '⏸';
          btn.querySelector('.txt').innerText = '일시정지';
          card.classList.add('playing');
        }}).catch(err => {{
          console.error('Audio play failed:', err);
          alert('재생 중 오류가 발생했습니다. 아래 내장 오디오 컨트롤러 재생 버튼을 눌러주세요.');
        }});
      }} else {{
        audio.pause();
        currentPlayingId = null;
        btn.classList.remove('playing');
        btn.querySelector('.icon').innerText = '▶';
        btn.querySelector('.txt').innerText = '실제 성대 목소리 듣기';
        card.classList.remove('playing');
      }}

      // 오디오 종료 시 UI 리셋
      audio.onended = function() {{
        currentPlayingId = null;
        btn.classList.remove('playing');
        btn.querySelector('.icon').innerText = '▶';
        btn.querySelector('.txt').innerText = '실제 성대 목소리 다시 듣기';
        card.classList.remove('playing');
      }};
    }}
  </script>
</body>
</html>
'''

    os.makedirs('public/cosyvoice_samples', exist_ok=True)
    with open('public/cosyvoice_samples/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)

    scratch_dir = 'C:/Users/rom96/.gemini/antigravity/brain/bc69cfff-9c24-465e-9f3c-035250ef48ad/scratch/cosyvoice_samples'
    os.makedirs(scratch_dir, exist_ok=True)
    with open(os.path.join(scratch_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)

    print('Successfully generated cosyvoice player pages!')

if __name__ == '__main__':
    generate_player()
