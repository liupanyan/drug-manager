import React, { useState } from 'react';
import { Plus, Upload, X, Clock, Link, Unlink, AlertCircle, CheckCircle2, Search, Package, AlertTriangle } from 'lucide-react';
import { Application, ApplicationType, DrugGroup } from '../types';
import { MOCK_PRODUCT_DB } from '../mockData';

interface ApplicationFormProps {
  onSubmit: (app: Omit<Application, 'id' | 'status' | 'submittedAt' | 'applicant'>) => void;
  applications: Application[];
  drugGroups: DrugGroup[];
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({ onSubmit, applications, drugGroups }) => {
  const [appType, setAppType] = useState<ApplicationType>('LINK');
  const [productIds, setProductIds] = useState<string[]>(['', '']); // Initialize with fields
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');
  const [imageCount, setImageCount] = useState(0);

  // Modal State for feedback
  const [modal, setModal] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({ show: false, type: 'success', title: '', message: '' });

  const handleAddId = () => {
    if (productIds.length < 3) {
      setProductIds([...productIds, '']);
    }
  };

  const handleRemoveId = (index: number) => {
    const newIds = [...productIds];
    newIds.splice(index, 1);
    setProductIds(newIds);
  };

  const handleIdChange = (index: number, value: string) => {
    const newIds = [...productIds];
    newIds[index] = value;
    setProductIds(newIds);
  };

  const showModal = (type: 'success' | 'error', title: string, message: string) => {
    setModal({ show: true, type, title, message });
  };

  const handleSubmit = () => {
    // Basic validation
    if (!subject.trim()) {
        showModal('error', '提交失败', '请输入申请事项');
        return;
    }

    const validIds = productIds.filter(id => id.trim() !== '');
    
    // Check for non-existent IDs
    const invalidIds = validIds.filter(id => !MOCK_PRODUCT_DB[id]);
    if (invalidIds.length > 0) {
        showModal('error', '提交失败', `以下商品ID不存在: ${invalidIds.join(', ')}。请检查输入。`);
        return;
    }
    
    if (appType === 'LINK') {
        if (validIds.length < 2) {
          showModal('error', '提交失败', '关联申请至少需要输入2个商品ID');
          return;
        }

        // Check if all IDs are already in the same group (redundant application)
        // Group IDs by the group they belong to
        const groupMap: Record<string, string[]> = {};
        let freeIds = 0;
        
        for (const id of validIds) {
            const group = drugGroups.find(g => g.productIds.includes(id));
            if (group) {
                if (!groupMap[group.id]) groupMap[group.id] = [];
                groupMap[group.id].push(id);
            } else {
                freeIds++;
            }
        }

        // If all IDs belong to the SAME group and there are no free IDs, it's fully redundant
        const groupIds = Object.keys(groupMap);
        if (freeIds === 0 && groupIds.length === 1) {
             const groupName = drugGroups.find(g => g.id === groupIds[0])?.name;
             showModal('error', '无需申请', `所选商品均已属于同品种组 "${groupName}"，无需再次申请关联。`);
             return;
        }

    } else {
        if (validIds.length < 1) {
          showModal('error', '提交失败', '解除申请至少需要输入1个商品ID');
          return;
        }

        // Logic check: Check if products exist in any group
        const notInGroupIds = validIds.filter(id => !drugGroups.some(g => g.productIds.includes(id)));
        if (notInGroupIds.length > 0) {
            showModal(
                'error',
                '提交失败',
                `拟解除商品 (${notInGroupIds.join(', ')}) 不在同品种列表内，请核实。`
            );
            return;
        }

        // Logic check: Cannot remove Main ID
        for (const id of validIds) {
          const group = drugGroups.find(g => g.id === id);
          if (group) {
             showModal(
                'error',
                '操作受限',
                `商品 ID ${id} 是同品种组 "${group.name}" 的主商品，不可移除。`
             );
             return;
          }
        }
    }

    // Check for Duplicate Pending Applications
    // Sort IDs to compare sets regardless of order
    const sortedCurrentIds = [...validIds].sort().join(',');
    const hasDuplicatePending = applications.some(app => 
        app.status === 'PENDING' && 
        app.type === appType && 
        [...app.productIds].sort().join(',') === sortedCurrentIds
    );

    if (hasDuplicatePending) {
        showModal('error', '重复申请', '已有相同内容的申请在审批队列，请勿重复提交。');
        return;
    }

    if (!reason.trim()) {
      showModal('error', '提交失败', '请输入申请理由');
      return;
    }

    onSubmit({
      type: appType,
      subject,
      productIds: validIds,
      reason,
      images: [] // Mock images
    });
    
    // Reset form
    setProductIds(appType === 'LINK' ? ['', ''] : ['']);
    setSubject('');
    setReason('');
    setImageCount(0);
    showModal('success', '提交成功', '您的申请已提交，请等待合规组审核。');
  };

  // Helper to render ID input feedback
  const renderIdFeedback = (id: string) => {
    if (!id) return null;

    const product = MOCK_PRODUCT_DB[id];
    
    // Case 1: ID Not Found
    if (!product) {
        return (
            <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={16} />
                <span>该商品ID不存在，请重新输入</span>
            </div>
        );
    }

    // Case 2: Product Found (Show Card)
    const existingGroup = drugGroups.find(g => g.productIds.includes(id));
    
    return (
        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
            {/* Warning if already in group (for LINK) or Context (for UNBIND) */}
            {existingGroup && appType === 'LINK' && (
                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-800 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>该商品已属于同品种组: <strong>{existingGroup.name}</strong></span>
                </div>
            )}
            
            {/* Product Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-start gap-3">
                <div className="bg-blue-50 p-2 rounded text-blue-500 shrink-0">
                    <Package size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800 text-sm truncate">{product.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            product.rxType === 'OTC' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                            {product.rxType}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                        <div className="flex gap-2">
                            <span className="text-gray-400">规格:</span> {product.spec}
                        </div>
                        <div className="flex gap-2">
                            <span className="text-gray-400">批文:</span> {product.approvalNo}
                        </div>
                        <div className="flex gap-2">
                            <span className="text-gray-400">厂家:</span> {product.manufacturer}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto relative">
      {/* Type Toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1.5 rounded-lg flex gap-1">
          <button
            onClick={() => {
                setAppType('LINK');
                setProductIds(['', '']);
            }}
            className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all ${
              appType === 'LINK'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Link size={16} /> 关联申请
          </button>
          <button
            onClick={() => {
                setAppType('UNBIND');
                setProductIds(['']);
            }}
            className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all ${
              appType === 'UNBIND'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Unlink size={16} /> 解除申请
          </button>
        </div>
      </div>

      {/* Submission Form */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 relative overflow-hidden">
        {/* Decorator line based on type */}
        <div className={`absolute top-0 left-0 w-full h-1 ${appType === 'LINK' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>

        <div className="mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className={`${appType === 'LINK' ? 'bg-blue-600' : 'bg-orange-600'} text-white p-1 rounded`}>
                {appType === 'LINK' ? <Link size={16}/> : <Unlink size={16}/>}
            </span> 
            {appType === 'LINK' ? '提交关联申请' : '提交解除申请'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {appType === 'LINK' 
                ? '申请将多个药品关联为同品种，需填写商品ID、申请理由并上传相关凭证图片'
                : '申请将商品从现有同品种组中解除绑定，需填写拟解除商品ID（不可解除主商品）'
            }
          </p>
        </div>

        {/* Subject */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            申请事项 <span className="text-red-500">*</span> <span className="text-xs font-normal text-gray-400">(最多15字)</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={15}
            placeholder={appType === 'LINK' ? "例如：申请关联维生素C片同品种" : "例如：申请解除xx商品同品种"}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
          />
        </div>

        {/* Product IDs */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {appType === 'LINK' ? '关联商品ID' : '拟解除商品'} <span className="text-red-500">*</span> 
            <span className="text-xs font-normal text-gray-400 ml-1">
                {appType === 'LINK' ? '(必填，最少2个)' : '(必填，最少1个)'}
            </span>
          </label>
          <div className="space-y-6">
            {productIds.map((id, index) => (
              <div key={index} className="relative">
                <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-gray-400 w-6 text-right">{index + 1}.</span>
                    <input
                    type="text"
                    value={id}
                    onChange={(e) => handleIdChange(index, e.target.value)}
                    placeholder={appType === 'LINK' ? `请输入第 ${index + 1} 个商品ID` : '请输入拟解除的商品ID'}
                    className={`flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all ${
                        id && !MOCK_PRODUCT_DB[id] 
                            ? 'border-red-300 focus:ring-red-100 focus:border-red-500 bg-red-50/10' 
                            : 'border-gray-300 focus:ring-blue-100 focus:border-blue-500'
                    }`}
                    />
                    {index === productIds.length - 1 && productIds.length < 3 ? (
                    <button
                        onClick={handleAddId}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                    >
                        <Plus size={16} /> 添加ID
                    </button>
                    ) : (
                    // Allow removal if count > 2 for LINK, or > 1 for UNBIND
                    index > 0 && productIds.length > (appType === 'LINK' ? 2 : 1) && (
                        <button
                        onClick={() => handleRemoveId(index)}
                        className="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm transition-colors"
                        title="删除此行"
                        >
                        <X size={18} />
                        </button>
                    )
                    )}
                </div>
                
                {/* Real-time Feedback Area */}
                <div className="pl-8 pr-[76px]">
                    {renderIdFeedback(id)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            申请理由 <span className="text-red-500">*</span> <span className="text-xs font-normal text-gray-400">(最多140字)</span>
          </label>
          <div className="relative">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={140}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-32 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none"
              placeholder={appType === 'LINK' ? "请说明为什么这些商品属于同一品种..." : "请说明解除该商品的原因..."}
            ></textarea>
            <span className="absolute bottom-2 right-2 text-xs text-gray-400">
              {reason.length}/140
            </span>
          </div>
        </div>

        {/* Images */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            上传凭证图片 <span className="text-xs font-normal text-gray-400">(可选，最多9张)</span>
          </label>
          <div className="flex gap-4 flex-wrap">
            <button 
              onClick={() => setImageCount(prev => Math.min(prev + 1, 9))}
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors bg-gray-50"
            >
              <Upload size={24} />
              <span className="text-xs mt-1">点击上传</span>
            </button>
            {[...Array(imageCount)].map((_, i) => (
              <div key={i} className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-xs relative group">
                  图片 {i + 1}
                  <button 
                    onClick={() => setImageCount(prev => prev - 1)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hidden group-hover:block shadow-sm"
                  >
                    <X size={12}/>
                  </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className={`w-full text-white font-medium py-3 rounded-lg transition-colors shadow-sm ${appType === 'LINK' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
        >
          {appType === 'LINK' ? '提交关联申请' : '提交解除申请'}
        </button>
      </div>

      {/* Application History */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock size={20} /> 申请记录
        </h3>
        
        {applications.length === 0 ? (
          <div className="text-center text-gray-500 py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
            暂无申请记录
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 font-medium text-gray-500">申请信息</th>
                    <th className="px-6 py-3 font-medium text-gray-500">类型</th>
                    <th className="px-6 py-3 font-medium text-gray-500">提交时间</th>
                    <th className="px-6 py-3 font-medium text-gray-500">商品详情</th>
                    <th className="px-6 py-3 font-medium text-gray-500 w-32">状态</th>
                    <th className="px-6 py-3 font-medium text-gray-500 w-40">审核意见</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applications.map(app => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800 mb-1">{app.subject}</div>
                        <div className="font-mono text-xs text-gray-400">{app.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        {app.type === 'UNBIND' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                解除申请
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                关联
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{app.submittedAt}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          {app.productIds.map(pid => {
                             const name = MOCK_PRODUCT_DB[pid]?.name || '未知商品';
                             return (
                               <div key={pid} className="flex items-center gap-2 text-xs">
                                 <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono border border-gray-200">{pid}</span>
                                 <span className="text-gray-700 truncate max-w-[200px]" title={name}>{name}</span>
                               </div>
                             );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {app.status === 'APPROVED' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            已批准
                          </span>
                        )}
                        {app.status === 'REJECTED' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            已拒绝
                          </span>
                        )}
                        {app.status === 'PENDING' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                            待审核
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {app.status !== 'PENDING' && app.reviewComment ? (
                            <div className="relative group cursor-help">
                              <span className="text-gray-600 text-xs">
                                {app.reviewComment.length > 15 ? app.reviewComment.slice(0, 15) + '...' : app.reviewComment}
                              </span>
                              {app.reviewComment.length > 15 && (
                                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-gray-800 text-white text-xs rounded shadow-lg hidden group-hover:block z-20 whitespace-normal break-words leading-relaxed">
                                   {app.reviewComment}
                                   <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                                 </div>
                              )}
                            </div>
                        ) : (
                            <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {modal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className={`flex items-center gap-3 mb-4 ${modal.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {modal.type === 'error' ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
              <h3 className="text-lg font-bold">{modal.title}</h3>
            </div>
            <p className="text-gray-600 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{modal.message}</p>
            <button 
              onClick={() => setModal({ ...modal, show: false })}
              className={`w-full font-medium py-2 rounded-lg transition-colors text-white ${
                modal.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
};