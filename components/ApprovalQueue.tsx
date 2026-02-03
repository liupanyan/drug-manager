import React, { useState, useEffect } from 'react';
import { Application, ProductDetail, DrugGroup } from '../types';
import { MOCK_PRODUCT_DB } from '../mockData';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ApprovalQueueProps {
  applications: Application[];
  existingGroups: DrugGroup[];
  onApprove: (
    app: Application, 
    strategy: 'NEW' | 'MERGE', 
    targetGroupId: string | undefined, 
    finalProductIds: string[], 
    finalMainId: string
  ) => void;
  onReject: (appId: string) => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ 
  applications, 
  existingGroups, 
  onApprove, 
  onReject 
}) => {
  // Simulating fetched details based on IDs in the application
  const getProductDetails = (ids: string[]): ProductDetail[] => {
    return ids.map(id => MOCK_PRODUCT_DB[id] || {
      id,
      name: '未知商品',
      brand: '未知',
      spec: '-',
      rxType: 'OTC',
      approvalNo: '-',
      manufacturer: '-'
    });
  };

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
        <span className="text-sm text-gray-500">当前有 {pendingApps.length} 个待处理的关联申请</span>
      </div>

      {pendingApps.map(app => (
        <ApprovalCard 
          key={app.id} 
          app={app} 
          details={getProductDetails(app.productIds)}
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
  details: ProductDetail[];
  existingGroups: DrugGroup[];
  onApprove: (
    app: Application, 
    strategy: 'NEW' | 'MERGE', 
    targetGroupId: string | undefined, 
    finalProductIds: string[], 
    finalMainId: string
  ) => void;
  onReject: (appId: string) => void;
}> = ({ app, details, existingGroups, onApprove, onReject }) => {
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
    for (const detail of details) {
      foundGroup = existingGroups.find(g => g.productIds.includes(detail.id));
      if (foundGroup) break;
    }

    const sortedIds = [...app.productIds].sort((a, b) => parseInt(a) - parseInt(b));
    const mainProduct = details.find(d => d.id === sortedIds[0]);

    let finalIds: string[] = [];
    let initialMainId = '';

    if (foundGroup) {
      // Merge Strategy
      finalIds = Array.from(new Set([...foundGroup.productIds, ...app.productIds])).sort((a, b) => parseInt(a) - parseInt(b));
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
        alert("关联商品ID至少需要2个");
        return;
      }
      
      if (!finalIds.includes(finalMainId)) {
        alert(`主ID (${finalMainId}) 必须包含在商品ID列表中`);
        return;
      }

      onApprove(app, analysis.strategy, analysis.targetGroup?.id, finalIds, finalMainId);
      setShowApproveModal(false);
    }
  };

  const confirmReject = () => {
    if (!rejectReason.trim()) {
      alert("请填写拒绝原因");
      return;
    }
    onReject(app.id);
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
        <div>
          <h3 className="text-base font-bold text-gray-800">申请 #{app.id}</h3>
          <p className="text-xs text-gray-500 mt-1">
            申请人: {app.applicant} | 提交时间: {app.submittedAt}
          </p>
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
          {details.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg p-4 text-sm hover:shadow-md transition-shadow bg-white">
              <div className="flex justify-between items-start mb-2">
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono">{item.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${item.rxType === 'OTC' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
                  {item.rxType}
                </span>
              </div>
              <div className="font-bold text-gray-900 mb-1">{item.name}</div>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="text-gray-400">品牌:</span> {item.brand}</p>
                <p><span className="text-gray-400">规格:</span> {item.spec}</p>
                <p><span className="text-gray-400">批文:</span> {item.approvalNo}</p>
                <p><span className="text-gray-400">厂家:</span> {item.manufacturer}</p>
              </div>
            </div>
          ))}
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
            <CheckCircle size={16} /> 批准 / 编辑关联
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