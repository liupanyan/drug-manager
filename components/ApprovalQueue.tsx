import React, { useState, useEffect } from 'react';
import { Application, ProductDetail, DrugGroup } from '../types';
import { MOCK_PRODUCT_DB } from '../mockData';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Link, Unlink, Trash2 } from 'lucide-react';

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
  const [approveComment, setApproveComment] = useState('');
  
  // Edit States for Approval
  const [editIdsStr, setEditIdsStr] = useState('');
  const [mainIdMode, setMainIdMode] = useState<'SYSTEM' | 'CUSTOM'>('SYSTEM');
  const [customMainId, setCustomMainId] = useState('');

  // Analysis State for Approval
  const [analysis, setAnalysis] = useState<{
    strategy: 'NEW' | 'MERGE';
    targetGroup?: DrugGroup;
    groupName: string;
  } | null>(null);

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
  // For Unbind: Show removed IDs + Main ID of the group they belong to (if found)
  // For Link: Show just the IDs in the app
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
        // Sort: Requested items (in app.productIds) first, then others (e.g. Main ID)
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

  // Analyze the application to decide if it's NEW or MERGE
  const handlePreApprove = () => {
    let foundGroup: DrugGroup | undefined;
    
    // Check if any ID is already in a group
    for (const pid of app.productIds) {
      foundGroup = existingGroups.find(g => g.productIds.includes(pid));
      if (foundGroup) break;
    }

    const sortedIds = [...app.productIds].sort((a, b) => parseInt(a) - parseInt(b));
    const mainProduct = getProductDetail(sortedIds[0]);

    let finalIds: string[] = [];
    let initialMainId = '';

    if (foundGroup) {
      // Merge Strategy (or Unbind from existing)
      // Logic: Start with existing group IDs combined with new ones (standard merge)
      // For Unbind: The Compliance officer must manually remove IDs from the textarea.
      // We load the FULL group list into the editor so they can remove specific ones.
      finalIds = Array.from(new Set([...foundGroup.productIds, ...app.productIds])).sort((a: string, b: string) => parseInt(a) - parseInt(b));
      initialMainId = foundGroup.id;
      
      setAnalysis({
        strategy: 'MERGE',
        targetGroup: foundGroup,
        groupName: foundGroup.name,
      });
    } else {
      // New Strategy
      finalIds = sortedIds;
      initialMainId = sortedIds[0];

      setAnalysis({
        strategy: 'NEW',
        groupName: mainProduct?.name || '未知同品种组',
      });
    }

    // Initialize Edit Form
    setEditIdsStr(finalIds.join(','));
    setCustomMainId(initialMainId);
    setMainIdMode('SYSTEM'); // Default to system
    
    setShowApproveModal(true);
  };

  const confirmApprove = () => {
    if (analysis) {
      const finalIds = getCleanIds(editIdsStr);
      const finalMainId = getEffectiveMainId(mainIdMode, customMainId, editIdsStr);

      if (finalIds.length < 2) {
        alert("关联商品ID至少需要2个 (如果是解绑导致剩余不足2个，建议直接删除分组)");
        // In a real app, we might handle "Delete Group" here if count < 2.
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="flex justify-between items-start p-6 pb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">批准 / 编辑关联</h3>
                <p className="text-xs text-gray-500 mt-1">请确认或编辑关联商品ID集合与主ID</p>
              </div>
              <button onClick={() => setShowApproveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4">
              {/* Info Banner */}
              {(app.type === 'LINK' || analysis.strategy === 'NEW') && (
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
                      ? '检测到新关联组，请确认商品ID列表。'
                      : `检测到部分商品已存在于关联组 "${analysis.groupName}"，列表已合并。`
                    }
                  </div>
                </div>
              )}
              
              {app.type === 'UNBIND' && (
                  <div className="bg-orange-50 border border-orange-100 text-orange-800 p-3 rounded-lg mb-5 text-sm flex gap-2">
                      <Unlink size={16} className="shrink-0 mt-0.5"/>
                      此为解除申请，请在下方列表中手动删除拟解除的ID。
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

            <div className="p-6 pt-0 flex justify-end gap-3 mt-2">
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