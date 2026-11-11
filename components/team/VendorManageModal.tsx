import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Edit2, Trash2, Check, X, ShieldAlert, 
  Phone, DollarSign, FileText, Loader2, Sparkles, RefreshCw
} from 'lucide-react';
import { 
  LeadVendor, fetchLeadVendors, createLeadVendor, 
  updateLeadVendor, deleteLeadVendor 
} from '../../services/vendor';
import { useToast } from '../../contexts/ToastContext';

interface VendorManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const VendorManageModal: React.FC<VendorManageModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const [vendors, setVendors] = useState<LeadVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    defaultUnitCost: 25000,
    leadType: '개인회생',
    asPolicy: '결번/중복 7일 이내 100% 무상 교환 또는 차감',
    contactPerson: '',
    memo: '',
  });

  const loadVendors = async () => {
    setLoading(true);
    try {
      const list = await fetchLeadVendors();
      setVendors(list);
    } catch (e: any) {
      showToast('거래처 목록 로드 실패: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVendors();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      defaultUnitCost: 25000,
      leadType: '개인회생',
      asPolicy: '결번/중복 7일 이내 100% 무상 교환 또는 차감',
      contactPerson: '',
      memo: '',
    });
  };

  const startEdit = (v: LeadVendor) => {
    setEditingId(v.id);
    setFormData({
      name: v.name,
      defaultUnitCost: v.defaultUnitCost,
      leadType: v.leadType,
      asPolicy: v.asPolicy || '',
      contactPerson: v.contactPerson || '',
      memo: v.memo || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('거래처 이름을 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateLeadVendor(editingId, {
          name: formData.name.trim(),
          defaultUnitCost: formData.defaultUnitCost,
          leadType: formData.leadType,
          asPolicy: formData.asPolicy,
          contactPerson: formData.contactPerson,
          memo: formData.memo,
        });
        showToast(`거래처 '${formData.name}' 정보가 수정되었습니다.`, 'success');
      } else {
        await createLeadVendor({
          name: formData.name.trim(),
          defaultUnitCost: formData.defaultUnitCost,
          leadType: formData.leadType,
          asPolicy: formData.asPolicy,
          contactPerson: formData.contactPerson,
          memo: formData.memo,
        });
        showToast(`새 거래처 '${formData.name}'이(가) 등록되었습니다.`, 'success');
      }
      resetForm();
      await loadVendors();
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || '저장 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`정말 거래처 '${name}'을(를) 삭제(비활성화)하시겠습니까?`)) return;
    try {
      await deleteLeadVendor(id);
      showToast(`거래처 '${name}'이(가) 삭제되었습니다.`, 'success');
      await loadVendors();
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || '삭제 실패', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                DB 거래처(공급사) 마스터 관리
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium">
                  {vendors.length}개 등록됨
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                DB 공급사별 기본 매입 단가(CPL) 및 A/S 환불 기준을 설정하여 회차 등록 시 자동 세팅합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left/Form: 등록/수정 패널 (5 cols) */}
          <div className="lg:col-span-5 bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                {editingId ? <Edit2 size={15} className="text-blue-500" /> : <Plus size={15} className="text-emerald-500" />}
                {editingId ? '거래처 정보 수정' : '신규 거래처 등록'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  수정 취소
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    거래처(공급사) 이름 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 패스트애드, 메타 랜딩 1팀, 네이버 파워링크"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      기본 매입 단가 (CPL)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="25000"
                        value={formData.defaultUnitCost}
                        onChange={(e) => setFormData({ ...formData, defaultUnitCost: Number(e.target.value) })}
                        className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute left-2.5 top-2.5 text-xs text-gray-400">₩</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      취급 DB 유형
                    </label>
                    <select
                      value={formData.leadType}
                      onChange={(e) => setFormData({ ...formData, leadType: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="개인회생">개인회생</option>
                      <option value="파산">파산</option>
                      <option value="신용회복">신용회복</option>
                      <option value="새출발기금">새출발기금</option>
                      <option value="종합 채무조정">종합 채무조정</option>
                      <option value="대출/금융">대출/금융</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    불량 DB A/S 환불·교환 기준
                  </label>
                  <input
                    type="text"
                    placeholder="예: 결번/중복 7일 이내 100% 무상 교환 또는 차감"
                    value={formData.asPolicy}
                    onChange={(e) => setFormData({ ...formData, asPolicy: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    담당자 연락처 / 소통 채널
                  </label>
                  <input
                    type="text"
                    placeholder="예: 김영수 팀장 010-1234-5678 (카톡 fastad_kim)"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    특이사항 메모
                  </label>
                  <textarea
                    rows={2}
                    placeholder="정산일, 세금계산서 발행 조건 등 메모"
                    value={formData.memo}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingId ? '수정 내용 저장' : '거래처 등록하기'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-gray-600 dark:text-gray-300"
                  >
                    취소
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right/List: 거래처 목록 (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pb-1">
              <span>등록된 거래처 목록</span>
              <button
                type="button"
                onClick={loadVendors}
                className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                <RefreshCw size={12} /> 새로고침
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[460px] pr-1">
              {vendors.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 text-xs">
                  등록된 거래처가 없습니다. 좌측에서 신규 거래처를 등록하세요.
                </div>
              ) : (
                vendors.map((v) => (
                  <div
                    key={v.id}
                    className={`p-4 rounded-xl border transition-all ${
                      editingId === v.id
                        ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {v.name}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium border border-blue-200 dark:border-blue-800">
                            {v.leadType}
                          </span>
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            CPL ₩{v.defaultUnitCost.toLocaleString()}
                          </span>
                        </div>

                        {v.asPolicy && (
                          <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                            <ShieldAlert size={12} className="text-amber-500 shrink-0" />
                            <span>A/S: {v.asPolicy}</span>
                          </div>
                        )}

                        {v.contactPerson && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                            <Phone size={12} className="shrink-0" />
                            <span>{v.contactPerson}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit(v)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          title="수정"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.name)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Sparkles size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>팁:</strong> 여기서 등록된 거래처는 DB 일괄 업로드 창에서 <strong>최근 거래처 칩</strong>으로 바로 뜨며, 선택 시 기본 단가가 자동 적용됩니다.
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
