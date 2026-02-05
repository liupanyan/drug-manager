import React, { useState, useEffect } from 'react';
import { Application, ProductDetail, DrugGroup } from '../types';
import { MOCK_PRODUCT_DB } from '../mockData';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Link, Unlink, Trash2, Sparkles, CheckSquare, Square, ArrowRight, Split, Check } from 'lucide-react';

interface ApprovalQueueProps {
  applications: Application[];
  existingGroups: DrugGroup[];
  onApprove: (
    app: Application, 
    strategy: 'NEW' | 'MERGE', 
    targetGroupId: string | undefined, 
    finalProductIds: string[], 
    finalMainId: string,
    comment?: string
  ) => void;
  onReject: (appId: string, reason: string) => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ 
  applications, 
  existingGroups, 
  onApprove, 
  onReject 
}) => {
  const pendingApps = applications.filter(app => app.status === 'PENDING');

  if (pendingApps.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-lg shadow-sm">
        <div className="text-gray-400 mb-2">🎉</div>
        <p className="text-gray-500">当前没有待审批的申请</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          📄 待审批申请
        </h2>
        <span className="text-sm text-gray-500">当前有 {pendingApps.length} 个待处理的申请</span>
      </div>

      {pendingApps.map(app => (
        <ApprovalCard 
          key={app.id} 
          app={app} 
          existingGroups={existingGroups}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
};

interface SimilarGroupMatch {
    group: DrugGroup;
    score: number;
    matchType: 'EXACT' | 'NAME_ONLY' | 'FUZZY';
}

interface AnalysisResult {
  strategy: 'NEW' | 'MERGE';
  targetGroup?: DrugGroup;
  groupName: string;
  detectedSimilarGroups?: SimilarGroupMatch[]; 
  detectedOrphans?: ProductDetail[]; // Unmanaged products found in DB
}

type ModalStep = 'VERIFY_SIMILAR' | 'EDIT_CONFIRM';

const ApprovalCard: React.FC<{
  app: Application;
  existingGroups: DrugGroup[];
  onApprove: (
    app: Application, 
    strategy: 'NEW' | 'MERGE', 
    targetGroupId: string | undefined, 
    finalProductIds: string[], 
    finalMainId: string,
    comment?: string
  ) => void;
  onReject: (appId: string, reason: string) => void;
}> = ({ app, existingGroups, onApprove, onReject }) => {
  // Modal States
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('EDIT_CONFIRM');
  
  const [approveComment, setApproveComment] = useState('');
  
  // Edit States for Approval
  const [editIdsStr, setEditIdsStr] = useState('');
  const [mainIdMode, setMainIdMode] = useState<'SYSTEM' | 'CUSTOM'>('SYSTEM');
  const [customMainId, setCustomMainId] = useState('');
  
  // Verify Step State
  const [selectedSimilarGroupId, setSelectedSimilarGroupId] = useState<string>('');

  // Orphan selection state
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);

  // Analysis State for Approval
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Helper to fetch details
  const getProductDetail = (id: string): ProductDetail => {
    return MOCK_PRODUCT_DB[id] || {
      id,
      name: '未知商品',
      brand: '未知',
      spec: '-',
      rxType: 'OTC',
      approvalNo: '-',
      manufacturer: '-'
    };
  };

  // Determine what to display based on Application Type
  const getDisplayDetails = () => {
    const idsToShow = new Set<string>(app.productIds);
    let contextMainId = '';

    if (app.type === 'UNBIND') {
        // Find the group these products belong to
        const group = existingGroups.find(g => g.productIds.some(pid => app.productIds.includes(pid)));
        if (group) {
            idsToShow.add(group.id);
            contextMainId = group.id;
        }
    }

    const details = Array.from(idsToShow).map((id: string) => {
        const d = getProductDetail(id);
        return { ...d, isContextMain: id === contextMainId && app.type === 'UNBIND' };
    });

    // Sort Logic
    if (app.type === 'UNBIND') {
        details.sort((a, b) => {
             const aIsTarget = app.productIds.includes(a.id);
             const bIsTarget = app.productIds.includes(b.id);
             if (aIsTarget && !bIsTarget) return -1;
             if (!aIsTarget && bIsTarget) return 1;
             return 0;
        });
    }

    return details;
  };

  const displayDetails = getDisplayDetails();

  // Helper to parse IDs from text input
  const getCleanIds = (str: string) => {
    return str.split(/[,，\n\s]+/).map(s => s.trim()).filter(s => s !== '');
  };

  // Helper to calculate effective Main ID
  const getEffectiveMainId = (currentMode: 'SYSTEM' | 'CUSTOM', currentCustomId: string, currentIdsStr: string) => {
    if (currentMode === 'CUSTOM') return currentCustomId;
    
    const ids = getCleanIds(currentIdsStr);
    if (ids.length === 0) return '';
    // Find min ID numerically
    const sorted = [...ids].sort((a, b) => parseInt(a) - parseInt(b));
    return sorted[0] || '';
  };

  // 1. Pre-Analyze: Decide if we need to Verify or go straight to Edit
  const handlePreApprove = () => {
    // A. Check for DIRECT ID Overlap
    let directMatchGroup: DrugGroup | undefined;
    for (const pid of app.productIds) {
      directMatchGroup = existingGroups.find(g => g.productIds.includes(pid));
      if (directMatchGroup) break;
    }

    const sortedIds = [...app.productIds].sort((a, b) => parseInt(a) - parseInt(b));
    const mainProduct = getProductDetail(sortedIds[0]);

    // B. Smart Detection: Find multiple similar groups (Only if NO direct match)
    let detectedMatches: SimilarGroupMatch[] = [];
    
    if (app.type === 'LINK' && !directMatchGroup && mainProduct) {
        const targetName = mainProduct.name;
        const targetRx = mainProduct.rxType;

        existingGroups.forEach(g => {
            const sampleId = g.productIds[0];
            const sampleProd = MOCK_PRODUCT_DB[sampleId];
            if (!sampleProd) return;

            // Scoring Logic
            if (sampleProd.name === targetName && sampleProd.rxType === targetRx) {
                detectedMatches.push({ group: g, score: 100, matchType: 'EXACT' });
            } else if (sampleProd.name === targetName) {
                detectedMatches.push({ group: g, score: 80, matchType: 'NAME_ONLY' });
            } else if (sampleProd.name.includes(targetName) || targetName.includes(sampleProd.name)) {
                // Simple fuzzy check
                detectedMatches.push({ group: g, score: 50, matchType: 'FUZZY' });
            }
        });
        
        // Sort by Score Descending
        detectedMatches.sort((a, b) => b.score - a.score);
    }

    // Default: Assume NEW Strategy
    let initialAnalysis: AnalysisResult = {
        strategy: 'NEW',
        groupName: mainProduct?.name || '未知同品种组',
        detectedSimilarGroups: detectedMatches
    };

    if (directMatchGroup) {
        // Case 1: Direct Match -> Force Merge -> Go to Edit
        initialAnalysis = {
            strategy: 'MERGE',
            targetGroup: directMatchGroup,
            groupName: directMatchGroup.name,
            detectedSimilarGroups: [] 
        };
        prepareEditState(initialAnalysis, directMatchGroup.productIds, directMatchGroup.id);
        setModalStep('EDIT_CONFIRM');
    } else if (detectedMatches.length > 0) {
        // Case 2: Similar Groups Detected -> Verify Step
        setAnalysis(initialAnalysis);
        setSelectedSimilarGroupId(detectedMatches[0].group.id); // Default select the best match
        setModalStep('VERIFY_SIMILAR');
    } else {
        // Case 3: No Match -> New Group -> Go to Edit
        prepareEditState(initialAnalysis, [], '');
        setModalStep('EDIT_CONFIRM');
    }
    
    setShowApproveModal(true);
  };

  // Helper to prepare state for Edit Step
  const prepareEditState = (currentAnalysis: AnalysisResult, existingIds: string[], existingMainId: string) => {
      // 1. Calculate Orphans based on the confirmed context
      const mainProduct = getProductDetail(app.productIds[0]);
      let orphans: ProductDetail[] = [];
      
      if (mainProduct && app.type === 'LINK') {
          const allGroupedIds = new Set(existingGroups.flatMap(g => g.productIds));
          const appIds = new Set(app.productIds);
          
          orphans = Object.values(MOCK_PRODUCT_DB).filter(p => {
              // Strict Orphan detection: Same Name + Same Rx
              return p.name === mainProduct.name && 
                     p.rxType === mainProduct.rxType && 
                     !allGroupedIds.has(p.id) && 
                     !appIds.has(p.id);
          });
      }

      // 2. Set Final IDs list
      const finalIds = Array.from(new Set([...existingIds, ...app.productIds])).sort((a: string, b: string) => parseInt(a) - parseInt(b));
      
      // 3. Set Main ID
      // If merging, prefer existingMainId. If New, prefer sortedIds[0].
      const finalMainId = existingMainId || finalIds[0];

      setAnalysis({ ...currentAnalysis, detectedOrphans: orphans });
      setEditIdsStr(finalIds.join(','));
      setCustomMainId(finalMainId);
      setMainIdMode('SYSTEM');
      setSelectedOrphans([]);
  };

  // Handlers for Verify Step
  const handleVerifyMerge = () => {
      if (!analysis || !analysis.detectedSimilarGroups) return;
      
      const selectedMatch = analysis.detectedSimilarGroups.find(m => m.group.id === selectedSimilarGroupId);
      if (!selectedMatch) return;

      const targetGroup = selectedMatch.group;
      const newAnalysis: AnalysisResult = {
          ...analysis,
          strategy: 'MERGE',
          targetGroup: targetGroup,
          groupName: targetGroup.name
      };
      
      prepareEditState(newAnalysis, targetGroup.productIds, targetGroup.id);
      setModalStep('EDIT_CONFIRM');
  };

  const handleVerifySkip = () => {
      if (!analysis) return;
      
      const newAnalysis: AnalysisResult = {
          ...analysis,
          strategy: 'NEW',
          targetGroup: undefined
      };
      
      prepareEditState(newAnalysis, [], '');
      setModalStep('EDIT_CONFIRM');
  };

  // Handler to toggle orphan
  const handleToggleOrphan = (orphanId: string) => {
      const isSelected = selectedOrphans.includes(orphanId);
      let newSelected: string[] = [];
      let currentIds = getCleanIds(editIdsStr);

      if (isSelected) {
          // Remove
          newSelected = selectedOrphans.filter(id => id !== orphanId);
          currentIds = currentIds.filter(id => id !== orphanId);
      } else {
          // Add
          newSelected = [...selectedOrphans, orphanId];
          if (!currentIds.includes(orphanId)) {
              currentIds.push(orphanId);
          }
      }
      
      currentIds.sort((a,b) => parseInt(a)-parseInt(b));
      setSelectedOrphans(newSelected);
      setEditIdsStr(currentIds.join(','));
  };

  const handleToggleAllOrphans = () => {
      if (!analysis?.detectedOrphans) return;
      
      const allOrphanIds = analysis.detectedOrphans.map(o => o.id);
      const allSelected = allOrphanIds.every(id => selectedOrphans.includes(id));

      if (allSelected) {
          // Deselect All
          const currentIds = getCleanIds(editIdsStr).filter(id => !allOrphanIds.includes(id));
          setSelectedOrphans([]);
          setEditIdsStr(currentIds.join(','));
      } else {
          // Select All
          const currentIds = getCleanIds(editIdsStr);
          const newIds = [...new Set([...currentIds, ...allOrphanIds])].sort((a,b) => parseInt(a)-parseInt(b));
          setSelectedOrphans(allOrphanIds);
          setEditIdsStr(newIds.join(','));
      }
  };

  const confirmApprove = () => {
    if (analysis) {
      const finalIds = getCleanIds(editIdsStr);
      const finalMainId = getEffectiveMainId(mainIdMode, customMainId, editIdsStr);

      if (finalIds.length < 2) {
        alert("关联商品ID至少需要2个 (如果是解绑导致剩余不足2个，建议直接删除分组)");
        return;
      }
      
      if (!finalIds.includes(finalMainId)) {
        alert(`主ID (${finalMainId}) 必须包含在商品ID列表中`);
        return;
      }

      onApprove(app, analysis.strategy, analysis.targetGroup?.id, finalIds, finalMainId, approveComment);
      setShowApproveModal(false);
    }
  };

  const confirmReject = () => {
    if (!rejectReason.trim()) {
      alert("请填写拒绝原因");
      return;
    }
    onReject(app.id, rejectReason);
    setShowRejectModal(false);
    setRejectReason('');
  };

  const effectiveMainId = getEffectiveMainId(mainIdMode, customMainId, editIdsStr);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
      
      {/* --- Reject Modal --- */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">确认拒绝申请</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-500 text-sm mb-4">请填写拒绝原因</p>
              <label className="block text-sm font-medium text-gray-700 mb-2">拒绝原因 <span className="text-red-500">*</span></label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm h-32 focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none resize-none"
                placeholder="请说明拒绝原因..."
              />
            </div>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="px-5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium"
              >
                取消
              </button>
              <button 
                onClick={confirmReject}
                className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium shadow-sm"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Approve Modal --- */}
      {showApproveModal && analysis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-xl shadow-xl w-full animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh] ${modalStep === 'VERIFY_SIMILAR' ? 'max-w-4xl' : 'max-w-2xl'}`}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-start p-6 pb-2 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                    {modalStep === 'VERIFY_SIMILAR' ? '智能比对确认' : '批准 / 编辑关联'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    {modalStep === 'VERIFY_SIMILAR' ? '系统检测到相似同品种组，请确认是否合并' : '请确认或编辑关联商品ID集合与主ID'}
                </p>
              </div>
              <button onClick={() => setShowApproveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* STEP 1: VERIFY SIMILAR GROUP */}
            {modalStep === 'VERIFY_SIMILAR' && analysis.detectedSimilarGroups && (
                <div className="flex flex-col flex-1 overflow-hidden p-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 shrink-0">
                        <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
                            <Sparkles size={18} />
                            <span>发现 {analysis.detectedSimilarGroups.length} 个潜在同品种组</span>
                        </div>
                        <p className="text-sm text-blue-700">
                            系统根据名称和处方类型检测到相似组。建议您合并到其中一个组，以减少数据碎片。
                        </p>
                    </div>

                    <div className="flex gap-6 items-stretch flex-1 min-h-0 mb-4">
                        
                        {/* LEFT: Application Product Card (Fixed) */}
                        <div className="w-1/3 flex flex-col border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm shrink-0">
                            <div className="bg-gray-50 border-b border-gray-100 p-3 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-700">当前申请商品</span>
                                <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded">源数据</span>
                            </div>
                            <div className="p-4 overflow-y-auto">
                                <h4 className="text-base font-bold text-gray-800 mb-4">{app.subject}</h4>
                                {(() => {
                                    const prod = getProductDetail(app.productIds[0]);
                                    return (
                                        <div className="space-y-3 text-sm">
                                            <div className="pb-3 border-b border-gray-100">
                                                <span className="block text-xs text-gray-400 mb-1">通用名称</span>
                                                <span className="font-bold text-gray-900">{prod.name}</span>
                                            </div>
                                            <div className="pb-3 border-b border-gray-100">
                                                <span className="block text-xs text-gray-400 mb-1">处方类型</span>
                                                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${
                                                    prod.rxType === 'OTC' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'
                                                }`}>{prod.rxType}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <span className="block text-xs text-gray-400 mb-1">ID</span>
                                                    <span className="font-mono text-gray-600">{prod.id}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-gray-400 mb-1">规格</span>
                                                    <span className="text-gray-600">{prod.spec}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-gray-400 mb-1">厂家</span>
                                                <span className="text-gray-600">{prod.manufacturer}</span>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Middle Arrow */}
                        <div className="flex items-center justify-center text-gray-300">
                            <ArrowRight size={28} />
                        </div>

                        {/* RIGHT: List of Candidate Groups */}
                        <div className="flex-1 flex flex-col border border-indigo-100 rounded-lg bg-indigo-50/20 overflow-hidden">
                            <div className="bg-indigo-50/50 border-b border-indigo-100 p-3 flex justify-between items-center">
                                <span className="text-sm font-bold text-indigo-900">选择要合并的目标组</span>
                                <span className="text-xs text-indigo-600">建议按相似度选择</span>
                            </div>
                            
                            <div className="p-3 overflow-y-auto space-y-3 flex-1">
                                {analysis.detectedSimilarGroups.map((match, idx) => {
                                    const isSelected = selectedSimilarGroupId === match.group.id;
                                    const mainProd = getProductDetail(match.group.id);
                                    
                                    return (
                                        <div 
                                            key={match.group.id}
                                            onClick={() => setSelectedSimilarGroupId(match.group.id)}
                                            className={`border rounded-lg p-3 cursor-pointer transition-all relative ${
                                                isSelected 
                                                    ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                                                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                                            }`}
                                        >
                                            {/* Selection Indicator */}
                                            <div className="absolute top-3 right-3">
                                                {isSelected 
                                                    ? <div className="bg-indigo-600 text-white rounded-full p-0.5"><Check size={14} strokeWidth={3} /></div>
                                                    : <div className="w-5 h-5 rounded-full border border-gray-300"></div>
                                                }
                                            </div>

                                            {/* Match Badge */}
                                            <div className="mb-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${
                                                    match.matchType === 'EXACT' ? 'bg-green-100 text-green-700' :
                                                    match.matchType === 'NAME_ONLY' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {match.matchType === 'EXACT' ? '完全匹配' : 
                                                     match.matchType === 'NAME_ONLY' ? '名称匹配' : '名称相似'}
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-bold text-gray-800 pr-8 mb-1">{match.group.name}</h4>
                                            
                                            <div className="text-xs text-gray-500 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-gray-100 px-1.5 rounded text-gray-500 border border-gray-200">ID: {match.group.id}</span>
                                                    <span>{mainProd.spec}</span>
                                                    <span className="truncate max-w-[100px]" title={mainProd.manufacturer}>{mainProd.manufacturer}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    <div className="flex gap-3 justify-end shrink-0 pt-4 border-t border-gray-100">
                        <button 
                            onClick={handleVerifySkip}
                            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
                        >
                            <Split size={16} /> 不合并，创建新组
                        </button>
                        <button 
                            onClick={handleVerifyMerge}
                            disabled={!selectedSimilarGroupId}
                            className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm flex items-center gap-2 transition-colors ${
                                selectedSimilarGroupId 
                                    ? 'bg-indigo-600 hover:bg-indigo-700' 
                                    : 'bg-indigo-300 cursor-not-allowed'
                            }`}
                        >
                            <Link size={16} /> 确认合并到选中组
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: EDIT & CONFIRM */}
            {modalStep === 'EDIT_CONFIRM' && (
                <>
                    <div className="px-6 py-4 overflow-y-auto flex-1">
                    {/* Strategy Info Banner */}
                    <div className={`flex items-start gap-3 p-3 rounded-lg border mb-5 ${
                        analysis.strategy === 'NEW' 
                            ? 'bg-blue-50 border-blue-100 text-blue-800'
                            : 'bg-yellow-50 border-yellow-100 text-yellow-800'
                    }`}>
                        <div className="mt-0.5">
                            {analysis.strategy === 'NEW' ? <Info size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div className="text-sm">
                            {analysis.strategy === 'NEW' 
                            ? '将创建新的关联组。'
                            : `将合并入现有组 "${analysis.groupName}" (ID: ${analysis.targetGroup?.id})。`
                            }
                        </div>
                    </div>
                    
                    {app.type === 'UNBIND' && (
                        <div className="bg-orange-50 border border-orange-100 text-orange-800 p-3 rounded-lg mb-5 text-sm flex gap-2">
                            <Unlink size={16} className="shrink-0 mt-0.5"/>
                            此为解除申请，请在下方列表中手动删除拟解除的ID。
                        </div>
                    )}

                    {/* Orphan Products Detection */}
                    {analysis.detectedOrphans && analysis.detectedOrphans.length > 0 && (
                        <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Info size={14} className="text-blue-500"/>
                                    发现 {analysis.detectedOrphans.length} 个潜在遗漏同品种商品
                                </h4>
                                <button 
                                    onClick={handleToggleAllOrphans}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    {analysis.detectedOrphans.every(o => selectedOrphans.includes(o.id)) ? '取消全选' : '全选添加'}
                                </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                                {analysis.detectedOrphans.map(orphan => (
                                    <label key={orphan.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                                        <div className="relative flex items-center">
                                            <input 
                                                type="checkbox" 
                                                className="peer h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
                                                checked={selectedOrphans.includes(orphan.id)}
                                                onChange={() => handleToggleOrphan(orphan.id)}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-bold text-gray-800">{orphan.name}</span>
                                                <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 rounded border border-gray-200">ID: {orphan.id}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 flex gap-3 truncate">
                                                <span>{orphan.brand}</span>
                                                <span className="border-l border-gray-300 pl-3">{orphan.spec}</span>
                                                <span className="border-l border-gray-300 pl-3">{orphan.manufacturer}</span>
                                                <span className="border-l border-gray-300 pl-3">{orphan.approvalNo}</span>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Editable Fields */}
                    <div className="space-y-4">
                        
                        {/* ID List Input */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-bold text-gray-700">编辑关联商品ID</label>
                                <span className="text-xs text-gray-400">多个ID用英文逗号分隔</span>
                            </div>
                            <textarea 
                                value={editIdsStr}
                                onChange={(e) => setEditIdsStr(e.target.value)}
                                className="w-full border border-blue-300 rounded-lg p-3 text-sm h-20 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none font-mono text-gray-700"
                            />
                        </div>

                        {/* Main ID Configuration */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-3">主ID设置</label>
                            <div className="flex items-center gap-6 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="mainIdMode" 
                                        checked={mainIdMode === 'SYSTEM'} 
                                        onChange={() => setMainIdMode('SYSTEM')}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">系统默认最小值</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="mainIdMode" 
                                        checked={mainIdMode === 'CUSTOM'} 
                                        onChange={() => setMainIdMode('CUSTOM')}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">自定义</span>
                                </label>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600 w-12 text-right">主 ID :</span>
                                <input 
                                    type="text" 
                                    value={effectiveMainId}
                                    onChange={(e) => {
                                        setCustomMainId(e.target.value);
                                        setMainIdMode('CUSTOM'); // Switch to custom if user types
                                    }}
                                    disabled={mainIdMode === 'SYSTEM'}
                                    className={`flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 ${
                                        mainIdMode === 'SYSTEM' ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-900'
                                    }`}
                                />
                            </div>
                        </div>

                        {/* Comment Input */}
                        <div className="pt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">审核意见 <span className="text-gray-400 font-normal">(可选)</span></label>
                            <input
                                type="text"
                                value={approveComment}
                                onChange={(e) => setApproveComment(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                                placeholder="请输入..."
                            />
                        </div>

                    </div>
                    </div>

                    <div className="p-6 pt-0 flex justify-end gap-3 mt-4 shrink-0">
                        <button 
                            onClick={() => setShowApproveModal(false)}
                            className="px-5 py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-medium"
                        >
                            取消
                        </button>
                        <button 
                            onClick={confirmApprove}
                            className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium shadow-sm flex items-center gap-1"
                        >
                            确认提交
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
      )}

      {/* --- Main Card Content --- */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                {app.subject}
                <span className="text-xs font-normal text-gray-400">#{app.id}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
                申请人: {app.applicant} | 提交时间: {app.submittedAt}
            </p>
          </div>
          {app.type === 'UNBIND' ? (
              <span className="bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                  <Unlink size={12}/> 解除申请
              </span>
          ) : (
              <span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                  <Link size={12}/> 关联
              </span>
          )}
        </div>
        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold border border-orange-200">
          待审核
        </span>
      </div>

      <div className="p-6">
        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Info size={16} /> 商品信息 (系统自动抓取)
        </h4>
        
        {/* Product Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {displayDetails.map((item: any) => {
            const isRemovalTarget = app.type === 'UNBIND' && app.productIds.includes(item.id);
            return (
              <div 
                  key={item.id} 
                  className={`border rounded-lg p-3 text-sm hover:shadow-md transition-shadow bg-white ${
                      item.isContextMain ? 'border-orange-300 bg-orange-50/30' : 
                      (isRemovalTarget ? 'border-red-300 bg-red-50/20' : 'border-gray-200')
                  }`}
              >
                <div className="flex items-center gap-2 mb-2 w-full overflow-hidden">
                   {/* ID */}
                   <span className={`px-1.5 py-0.5 rounded text-xs font-mono border flex items-center gap-1 shrink-0 ${
                      item.isContextMain ? 'bg-orange-100 text-orange-700 border-orange-200 font-bold' : 'bg-gray-100 text-gray-600 border-gray-200'
                   }`}>
                      {item.id}
                      {item.isContextMain && <span title="主ID">★</span>}
                   </span>

                   {/* Rx */}
                   <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                      item.rxType === 'OTC' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'
                   }`}>
                      {item.rxType}
                   </span>

                   {/* Removal Label */}
                   {isRemovalTarget && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-700 bg-red-50 shrink-0">
                          拟解除
                      </span>
                   )}

                   {/* Name */}
                   <span className="font-bold text-gray-900 truncate" title={item.name}>{item.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
                   <p className="truncate"><span className="text-gray-400">品牌:</span> {item.brand}</p>
                   <p className="truncate"><span className="text-gray-400">规格:</span> {item.spec}</p>
                   <p className="truncate col-span-2"><span className="text-gray-400">批文:</span> {item.approvalNo}</p>
                   <p className="truncate col-span-2"><span className="text-gray-400">厂家:</span> {item.manufacturer}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
          <h4 className="text-xs font-bold text-gray-500 mb-1 uppercase">申请理由</h4>
          <p className="text-sm text-gray-800 leading-relaxed">{app.reason}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-4 border-t border-gray-100 pt-4">
          <button 
            onClick={handlePreApprove}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <CheckCircle size={16} /> 批准 / 编辑
          </button>
          <button 
            onClick={() => setShowRejectModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <XCircle size={16} /> 拒绝申请
          </button>
        </div>
      </div>
    </div>
  );
};