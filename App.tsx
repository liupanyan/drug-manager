import React, { useState } from 'react';
import { Role, DrugGroup, Application } from './types';
import { INITIAL_DRUG_GROUPS, INITIAL_APPLICATIONS, MOCK_PRODUCT_DB } from './mockData';
import { DrugList } from './components/DrugList';
import { ApplicationForm } from './components/ApplicationForm';
import { ApprovalQueue } from './components/ApprovalQueue';
import { ShieldCheck, Briefcase, List, FilePlus, CheckSquare } from 'lucide-react';

function App() {
  // Global State
  const [role, setRole] = useState<Role>('BUSINESS');
  const [activeTab, setActiveTab] = useState<'list' | 'application' | 'approval'>('list');
  
  // Data State
  const [drugGroups, setDrugGroups] = useState<DrugGroup[]>(INITIAL_DRUG_GROUPS);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);

  // Handlers
  const handleDeleteGroup = (id: string) => {
    if (confirm('确定要删除这个同品种关联组吗？删除后不可恢复。')) {
      setDrugGroups(drugGroups.filter(g => g.id !== id));
    }
  };

  const handleSubmitApplication = (newApp: Omit<Application, 'id' | 'status' | 'submittedAt' | 'applicant'>) => {
    const application: Application = {
      ...newApp,
      id: `sub-${Date.now()}`,
      status: 'PENDING',
      submittedAt: new Date().toLocaleString(),
      applicant: role === 'BUSINESS' ? '业务经办人' : '合规专员'
    };
    setApplications([application, ...applications]);
    // Optional: Switch tab or show notification handled in form
  };

  const handleApproveApplication = (
    app: Application, 
    strategy: 'NEW' | 'MERGE', 
    targetGroupId: string | undefined,
    finalProductIds: string[],
    finalMainId: string
  ) => {
    // 1. Update Application Status
    setApplications(apps => apps.map(a => 
      a.id === app.id ? { ...a, status: 'APPROVED' } : a
    ));

    // 2. Update Drug Groups Logic
    if (strategy === 'NEW') {
      // Create new group
      const mainProduct = MOCK_PRODUCT_DB[finalMainId];
      const newGroup: DrugGroup = {
        id: finalMainId,
        name: mainProduct ? mainProduct.name : '同品种药品组', // Fallback name
        productIds: finalProductIds,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setDrugGroups(prev => [newGroup, ...prev]);
    } else if (strategy === 'MERGE' && targetGroupId) {
      // Merge into existing group and update Main ID if necessary
      setDrugGroups(prev => prev.map(group => {
        if (group.id === targetGroupId) {
          return {
            ...group,
            id: finalMainId, // Update Main ID based on approval decision
            productIds: finalProductIds // Update list based on approval decision
          };
        }
        return group;
      }));
    }

    alert(`申请已批准！已${strategy === 'NEW' ? '创建新关联组' : '更新现有关联组'}。`);
  };

  const handleRejectApplication = (appId: string) => {
    setApplications(apps => apps.map(a => 
      a.id === appId ? { ...a, status: 'REJECTED' } : a
    ));
    alert('申请已拒绝。');
  };

  // Helper to get pending count
  const pendingCount = applications.filter(a => a.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">同品种药品管理系统</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">当前角色:</span>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => { setRole('BUSINESS'); setActiveTab('list'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  role === 'BUSINESS' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Briefcase size={16} /> 业务组
              </button>
              <button
                onClick={() => { setRole('COMPLIANCE'); setActiveTab('list'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  role === 'COMPLIANCE' 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShieldCheck size={16} /> 合规组
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <List size={18} /> 同品种列表
          </button>
          
          {role !== 'COMPLIANCE' && (
            <button
              onClick={() => setActiveTab('application')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'application'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FilePlus size={18} /> 提交申请
            </button>
          )}

          {role === 'COMPLIANCE' && (
            <button
              onClick={() => setActiveTab('approval')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'approval'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CheckSquare size={18} /> 
              审批队列
              {pendingCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab Panels */}
        <div className="animate-in fade-in duration-300">
          {activeTab === 'list' && (
            <DrugList 
              groups={drugGroups} 
              role={role} 
              onDelete={handleDeleteGroup} 
            />
          )}

          {activeTab === 'application' && role !== 'COMPLIANCE' && (
            <ApplicationForm onSubmit={handleSubmitApplication} />
          )}

          {activeTab === 'approval' && role === 'COMPLIANCE' && (
            <ApprovalQueue 
              applications={applications}
              existingGroups={drugGroups}
              onApprove={handleApproveApplication}
              onReject={handleRejectApplication}
            />
          )}
        </div>

      </main>
    </div>
  );
}

export default App;