import React, { useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { Application } from '../types';

interface ApplicationFormProps {
  onSubmit: (app: Omit<Application, 'id' | 'status' | 'submittedAt' | 'applicant'>) => void;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({ onSubmit }) => {
  const [productIds, setProductIds] = useState<string[]>(['', '']); // Initialize with 2 empty fields
  const [reason, setReason] = useState('');
  const [imageCount, setImageCount] = useState(0);

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

  const handleSubmit = () => {
    // Basic validation
    const validIds = productIds.filter(id => id.trim() !== '');
    if (validIds.length < 2) {
      alert("请至少输入2个商品ID进行关联");
      return;
    }
    if (!reason.trim()) {
      alert("请输入申请理由");
      return;
    }

    onSubmit({
      productIds: validIds,
      reason,
      images: [] // Mock images
    });
    
    // Reset form
    setProductIds(['', '']);
    setReason('');
    setImageCount(0);
    alert("申请提交成功！");
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-4xl mx-auto border border-gray-100">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-gray-800 text-white p-1 rounded">📄</span> 提交关联申请
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          申请将多个药品关联为同品种，需填写商品ID、申请理由并上传相关凭证图片
        </p>
      </div>

      {/* Product IDs */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          关联商品ID <span className="text-red-500">*</span> <span className="text-xs font-normal text-gray-400">(必填，最少2个，最多3个)</span>
        </label>
        <div className="space-y-3">
          {productIds.map((id, index) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="text-xs font-bold text-gray-400 w-6 text-right">{index + 1}.</span>
              <input
                type="text"
                value={id}
                onChange={(e) => handleIdChange(index, e.target.value)}
                placeholder={`请输入第 ${index + 1} 个商品ID`}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              />
              {index === productIds.length - 1 && productIds.length < 3 ? (
                <button
                  onClick={handleAddId}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Plus size={16} /> 添加ID
                </button>
              ) : (
                index > 0 && productIds.length > 2 && (
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
            placeholder="请说明为什么这些商品属于同一品种..."
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
        className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-lg transition-colors shadow-sm"
      >
        提交申请
      </button>
    </div>
  );
};