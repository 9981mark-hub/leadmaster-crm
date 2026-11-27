import React, { useState } from 'react';
import {
  X, BookOpen, Copy, Check, AlertTriangle, CheckCircle2,
  Search, Send, ShieldAlert, Users, Sparkles
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelegramBotGuideModal({ isOpen, onClose }: Props) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const CopyBtn = ({ value, label }: { value: string; label?: string }) => (
    <button
      type="button"
      onClick={() => copyText(value)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-mono font-bold transition-colors cursor-pointer"
      title={`${value} 복사`}
    >
      {copiedCmd === value ? <Check size={11} /> : <Copy size={11} />}
      <span>{copiedCmd === value ? '복사됨!' : (label || value)}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 모달 헤더 */}
        <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                텔레그램 봇 생성 및 연결 완벽 설명서 (초보자용 3분 가이드)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                처음 해보셔도 화면 예시대로만 따라 하시면 누구나 3분 만에 연결할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs leading-relaxed">
          {/* 사전 안내 */}
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-foreground flex items-start gap-2.5">
            <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs text-blue-600 dark:text-blue-400">
                왜 봇을 만드나요?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                변호사 사무실 텔레그램 방에 올라오는 회신(피드백)을 우리 회사 CRM으로 자동 수집하려면 전용 수신 봇이 1개 필요합니다.
                한 번만 만들어 연결해 두면 이후로는 자동으로 작동합니다.
              </p>
            </div>
          </div>

          {/* STEP 1 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center">1</span>
                텔레그램에서 공식 @BotFather 찾기
              </span>
              <CopyBtn value="@BotFather" />
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-4 items-center">
              <ol className="list-decimal ml-4 space-y-1.5 text-foreground">
                <li>PC 또는 휴대폰에서 <b>텔레그램</b>을 실행합니다.</li>
                <li>상단 검색창(🔍)에 <CopyBtn value="@BotFather" /> 를 입력해 검색합니다.</li>
                <li>이름 옆에 <b>파란색 공식 체크(✓) 마크</b>가 있는 <b>BotFather</b>를 선택합니다.</li>
                <li>채팅방 하단의 파란색 <b>[시작 (START)]</b> 버튼을 누릅니다.</li>
              </ol>
              {/* 텔레그램 검색 목업 */}
              <div className="rounded-xl bg-[#17212b] text-white p-3 border border-slate-700 font-sans text-[11px] space-y-2">
                <div className="flex items-center gap-2 bg-[#242f3d] px-2.5 py-1.5 rounded-lg text-slate-300">
                  <Search size={12} />
                  <span>@BotFather</span>
                </div>
                <div className="flex items-center gap-2.5 bg-[#2b5278]/60 p-2 rounded-lg border border-sky-500/40">
                  <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center font-bold text-white shrink-0">BF</div>
                  <div className="min-w-0">
                    <div className="font-bold flex items-center gap-1">
                      <span>BotFather</span>
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-400 text-[9px] text-white">✓</span>
                    </div>
                    <div className="text-[10px] text-sky-300">@BotFather · 공식 봇 관리자</div>
                  </div>
                </div>
                <div className="text-center py-1 rounded bg-sky-600/80 font-bold text-white text-[11px]">
                  START (시작)
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center">2</span>
                /newbot 으로 새 봇 이름 2가지 입력하기
              </span>
              <CopyBtn value="/newbot" />
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-2.5 text-foreground">
                <ol className="list-decimal ml-4 space-y-1.5">
                  <li>채팅창에 <CopyBtn value="/newbot" /> 을 입력해 전송합니다.</li>
                  <li>
                    <b>첫 번째 질문</b>이 나오면 봇의 <b>표시 이름</b>을 입력합니다.<br />
                    <span className="text-muted-foreground">(한글 가능 · 예: <code className="bg-muted px-1 rounded">OO법률 CRM봇</code>)</span>
                  </li>
                  <li>
                    <b>두 번째 질문</b>이 나오면 봇의 <b>영문 아이디</b>를 입력합니다.<br />
                    <span className="text-rose-500 font-semibold">※ 반드시 영문/숫자만 쓰고 끝이 <code className="bg-rose-500/10 px-1 rounded">bot</code>으로 끝나야 합니다!</span><br />
                    <span className="text-muted-foreground">(예: <code className="bg-muted px-1 rounded">oo_law_crm_bot</code>)</span>
                  </li>
                </ol>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-700 dark:text-amber-300">
                  <b>💡 이미 사용 중이라고 나오나요?</b><br />
                  <code className="font-mono">Sorry, this username is already taken</code>이 뜨면 다른 사람이 이미 쓰는 아이디입니다. 뒤에 숫자(예: <code className="font-mono">_2026_bot</code>)를 붙여서 다시 보내세요!
                </div>
              </div>
              {/* 텔레그램 /newbot 대화 목업 */}
              <div className="rounded-xl bg-[#17212b] text-white p-3 border border-slate-700 font-sans text-[11px] space-y-2">
                <div className="flex justify-end">
                  <span className="bg-[#2b5278] px-2.5 py-1 rounded-lg">/newbot</span>
                </div>
                <div className="bg-[#182533] border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200">
                  Alright, a new bot. How are we going to call it?
                </div>
                <div className="flex justify-end">
                  <span className="bg-[#2b5278] px-2.5 py-1 rounded-lg">우리회사 상담봇</span>
                </div>
                <div className="bg-[#182533] border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200">
                  Good. Now let's choose a username. It must end in <b className="text-sky-300">bot</b>.
                </div>
                <div className="flex justify-end">
                  <span className="bg-[#2b5278] px-2.5 py-1 rounded-lg font-mono text-emerald-300">my_crm_2026_bot</span>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center">3</span>
                발급된 토큰 복사 → 리드마스터에 붙여넣기
              </span>
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-4 items-center">
              <ol className="list-decimal ml-4 space-y-1.5 text-foreground">
                <li>생성이 완료되면 BotFather가 긴 영문·숫자 암호(<b>토큰</b>)를 보내줍니다.</li>
                <li>텔레그램 화면에서 <b>토큰 글자를 한 번 클릭</b>하면 자동으로 복사됩니다.</li>
                <li>이 화면으로 돌아와 <b>[봇 토큰 등록]</b> 칸에 붙여넣고 <b>[저장하고 연결]</b> 버튼을 누릅니다.</li>
              </ol>
              {/* 토큰 발급 목업 */}
              <div className="rounded-xl bg-[#17212b] text-white p-3 border border-slate-700 font-sans text-[11px] space-y-1.5">
                <div className="text-emerald-300 font-bold">Done! Congratulations on your new bot.</div>
                <div className="text-slate-300 text-[10px]">Use this token to access the HTTP API:</div>
                <div className="p-2 rounded bg-[#0e1621] border border-amber-400/50 font-mono text-[10px] text-amber-300 break-all">
                  7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </div>
                <div className="text-[10px] text-sky-300">👆 이 암호 줄을 통째로 복사해서 붙여넣으세요!</div>
              </div>
            </div>
          </div>

          {/* STEP 4 (가장 중요!) */}
          <div className="border-2 border-rose-500/40 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-between">
              <span className="font-bold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert size={16} />
                4단계 [필수!] 그룹방 대화 읽기 허용 (/setprivacy → Disable)
              </span>
              <CopyBtn value="/setprivacy" />
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-2 text-foreground">
                <p className="text-rose-600 dark:text-rose-400 font-bold">
                  ※ 이 설정을 안 하면 봇이 그룹방의 피드백 글을 읽지 못합니다!
                </p>
                <ol className="list-decimal ml-4 space-y-1.5">
                  <li>다시 <b>@BotFather</b> 채팅창에 <CopyBtn value="/setprivacy" /> 를 입력해 전송합니다.</li>
                  <li>하단에 나타나는 내 봇(<code className="font-mono">@방금만든봇</code>)을 클릭합니다.</li>
                  <li>선택 버튼 중 <b><code className="bg-rose-500/15 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold">Disable</code></b> 을 누릅니다.</li>
                  <li><code className="text-emerald-600 dark:text-emerald-400 font-mono">DISABLED</code> 완료 메시지를 확인합니다.</li>
                </ol>
              </div>
              {/* /setprivacy 목업 */}
              <div className="rounded-xl bg-[#17212b] text-white p-3 border border-slate-700 font-sans text-[11px] space-y-2">
                <div className="flex justify-end">
                  <span className="bg-[#2b5278] px-2.5 py-1 rounded-lg">/setprivacy</span>
                </div>
                <div className="bg-[#182533] border border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200">
                  Choose a bot to change group messages settings.
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="py-1 text-center rounded bg-[#242f3d] text-slate-400">Enable</div>
                  <div className="py-1 text-center rounded bg-rose-600 text-white font-bold ring-2 ring-rose-300">Disable 👈 클릭!</div>
                </div>
                <div className="text-[10px] text-emerald-300">Success! The new status is: DISABLED.</div>
              </div>
            </div>
          </div>

          {/* STEP 5 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center">5</span>
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <Users size={15} className="text-primary" />
                변호사 사무실 텔레그램 방에 봇 초대 & 우리 직원 이름 등록
              </span>
            </div>
            <div className="p-4 space-y-2 text-foreground">
              <ol className="list-decimal ml-4 space-y-1.5">
                <li>
                  변호사 사무실 텔레그램 방 관리자(방장)에게 방금 만든 봇 아이디(예: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">@my_crm_2026_bot</code>)를 알려주고 <b>그룹방에 초대</b>해 달라고 요청합니다.
                </li>
                <li>
                  초대가 완료되면 이 화면 상단의 <b>[상태 확인]</b>을 눌러 <span className="text-primary font-bold">연결됨</span> 표시를 확인합니다.
                </li>
                <li>
                  아래 <b>[우리 쪽 발신자 이름 (수집 제외)]</b> 칸에 우리 사무실 직원들의 텔레그램 대화명(예: <code className="bg-muted px-1 rounded">홍길동, 김실장</code>)을 입력해 두면, 우리 직원이 올린 글은 피드백으로 섞이지 않고 변호사 사무실 답변만 깔끔하게 수집됩니다.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <span className="text-2xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-primary" />
            한 번만 설정하면 이후 모든 피드백이 자동으로 수집됩니다.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}
