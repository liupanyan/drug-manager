import React, { useState } from 'react';
import { DrugGroup, Role, ProductDetail } from '../types';
import { MOCK_PRODUCT_DB } from '../mockData';
import { Search, Plus, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface DrugListProps {
  groups: DrugGroup[];
  role: Role;
  onDelete: (id: string) => void;
}

export const DrugList: React.FC<DrugListProps> = ({ groups, role, onDelete }) => {
  const [searchId, setSearchId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const filteredGroups = groups.filter(g => {
    const matchesId = searchId ? g.productIds.join(',').includes(searchId) : true;
    const matchesName = searchName ? g.name.includes(searchName) : true;
    return matchesId && matchesName;
  });

  const toggleRow = (id: string) => {
    if (expandedGroupId === id) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 min-h-[600px]">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">商品ID</label>
          <input
            type="text"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-blue-500"
            placeholder="请输入商品ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">商品名称</label>
          <input
            type="text"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-blue-500"
            placeholder="请输入商品名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>
        <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded text-sm flex items-center gap-1 transition-colors">
          <Search size={14} /> 搜索
        </button>
        {role === 'COMPLIANCE' && (
          <button className="border border-blue-500 text-blue-500 hover:bg-blue-50 px-4 py-1.5 rounded text-sm flex items-center gap-1 transition-colors">
            <Plus size={14} /> 新增
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
        <span>显示</span>
        <select className="border border-gray-300 rounded px-2 py-1 focus:outline-none">
          <option>10</option>
          <option>20</option>
          <option>50</option>
        </select>
        <span>条数据</span>
      </div>

      {/* Table Heading */}
      <h3 className="text-sm font-medium text-gray-900 mb-2">关联商品ID的订单统一计算均价</h3>

      {/* Table */}
      <div className="overflow-x-auto border-t border-gray-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <th className="py-4 px-4 w-20">序号</th>
              <th className="py-4 px-4">商品名称</th>
              <th className="py-4 px-4">商品ID集合</th>
              <th className="py-4 px-4 w-32">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredGroups.map((group, index) => {
              const isExpanded = expandedGroupId === group.id;
              return (
                <React.Fragment key={group.id}>
                  <tr 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                    onClick={() => toggleRow(group.id)}
                  >
                    <td className="py-4 px-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-blue-500 transition-colors">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        <span>{index + 1}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900 font-medium">
                      {group.name}
                      <span className="ml-2 text-xs font-normal text-gray-400">({group.productIds.length}个)</span>
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {group.productIds.map(pid => {
                          const isMain = pid === group.id;
                          return (
                            <span 
                              key={pid} 
                              className={`px-2 py-0.5 rounded text-xs font-mono flex items-center gap-1 border ${
                                isMain 
                                  ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' 
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              {pid}
                              {isMain && <span title="主ID">★</span>}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-3">
                        <button 
                          className={role === 'COMPLIANCE' ? "text-blue-500 hover:underline" : "text-gray-300 cursor-not-allowed"}
                          disabled={role !== 'COMPLIANCE'}
                        >
                          编辑
                        </button>
                        <button 
                          className={role === 'COMPLIANCE' ? "text-red-500 hover:underline" : "text-gray-300 cursor-not-allowed"}
                          disabled={role !== 'COMPLIANCE'}
                          onClick={role === 'COMPLIANCE' ? () => onDelete(group.id) : undefined}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="p-0 border-b border-gray-200 bg-gray-50/50">
                        <div className="p-6 pl-12">
                          <h4 className="text-sm font-semibold text-gray-700 mb-4">关联商品列表</h4>
                          <div className="space-y-3">
                            {group.productIds.map(pid => {
                              const detail = MOCK_PRODUCT_DB[pid] || {
                                id: pid,
                                name: '未知商品',
                                brand: '未知',
                                spec: '-',
                                rxType: 'OTC',
                                approvalNo: '-',
                                manufacturer: '-'
                              } as ProductDetail;
                              const isMain = pid === group.id;

                              return (
                                <div key={pid} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden">
                                  {/* Main Product Badge */}
                                  {isMain && (
                                    <div className="absolute top-0 right-0 bg-orange-400 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold shadow-sm z-10">
                                      主商品
                                    </div>
                                  )}
                                  
                                  {/* Left Icon */}
                                  <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-500 rounded-lg self-center md:self-start mt-1">
                                    <Package size={24} strokeWidth={1.5} />
                                  </div>

                                  {/* Info Content */}
                                  <div className="flex-1 min-w-0">
                                    {/* Header: Name + ID + Badge Inline */}
                                    <div className="mb-3 flex items-center gap-3 flex-wrap">
                                        <h4 className="text-base font-bold text-gray-800 truncate" title={detail.name}>{detail.name}</h4>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] border border-gray-200">ID: {detail.id}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                            detail.rxType === 'OTC' 
                                                ? 'bg-green-50 text-green-700 border-green-200' 
                                                : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            {detail.rxType === 'OTC' ? 'OTC' : '处方药'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Detail Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 text-sm border-t border-gray-100 pt-2">
                                      <div>
                                        <span className="block text-xs text-gray-400 mb-0.5">品牌</span>
                                        <span className="font-medium text-gray-800">{detail.brand}</span>
                                      </div>
                                      
                                      <div>
                                        <span className="block text-xs text-gray-400 mb-0.5">规格</span>
                                        <span className="font-medium text-gray-800">{detail.spec}</span>
                                      </div>

                                      <div className="col-span-2 md:col-span-1">
                                        <span className="block text-xs text-gray-400 mb-0.5">批文号</span>
                                        <span className="text-gray-600 font-mono text-xs truncate block" title={detail.approvalNo}>
                                          {detail.approvalNo}
                                        </span>
                                      </div>

                                      <div className="col-span-2 md:col-span-1">
                                        <span className="block text-xs text-gray-400 mb-0.5">厂家</span>
                                        <span className="text-gray-600 text-xs truncate block" title={detail.manufacturer}>
                                            {detail.manufacturer}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};