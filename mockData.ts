import { DrugGroup, ProductDetail, Application } from './types';

// Existing groups shown in Image 1
export const INITIAL_DRUG_GROUPS: DrugGroup[] = [
  { id: '251', name: '999 六味地黄丸', productIds: ['251', '3654826'], createdAt: '2023-01-01' },
  { id: '451', name: '九芝堂 杞菊地黄丸', productIds: ['451', '1262563'], createdAt: '2023-02-15' },
  { id: '672', name: '江西民济 全鹿丸', productIds: ['672', '910291'], createdAt: '2023-03-10' },
  { id: '674', name: '白云山 花城 龟鹿补肾丸', productIds: ['674', '1605383'], createdAt: '2023-04-05' },
  { id: '1032', name: '森科源 复方黄连素片', productIds: ['1032', '3875884'], createdAt: '2023-05-20' },
  { id: '1414', name: '999 小儿氨酚黄那敏颗粒', productIds: ['1414', '449286', '3443006'], createdAt: '2023-06-12' },
  
  // Existing Group for Amoxicillin (Match 1: Exact)
  { id: '2001', name: '阿莫西林胶囊', productIds: ['2001', '2002'], createdAt: '2023-07-01' },
  
  // Scenario: Duplicate Group for Amoxicillin (Match 2: Exact - maybe created by mistake)
  { id: '2005', name: '阿莫西林胶囊', productIds: ['2005'], createdAt: '2023-08-01' },

  // Scenario: Similar Name Group (Match 3: Partial)
  { id: '2099', name: '阿莫西林分散片', productIds: ['2099'], createdAt: '2023-08-05' },
];

// Mock Database of Products (used for "System Auto Pull" feature)
export const MOCK_PRODUCT_DB: Record<string, ProductDetail> = {
  // Existing Vitamin C logic
  '1001': { id: '1001', name: '阿莫西林胶囊', brand: '修正', spec: '0.25g*24粒', rxType: 'Rx', approvalNo: '国药准字H22022567', manufacturer: '修正药业集团股份有限公司' },
  '1002': { id: '1002', name: '阿莫西林胶囊', brand: '石药', spec: '0.25g*20粒', rxType: 'Rx', approvalNo: '国药准字H13021750', manufacturer: '石药集团有限公司' },
  '1003': { id: '1003', name: '阿莫西林胶囊', brand: '白云山', spec: '0.25g*30粒', rxType: 'Rx', approvalNo: '国药准字H44021234', manufacturer: '广州白云山制药' },
  '1008': { id: '1008', name: '维生素C片', brand: '汤臣倍健', spec: '100mg*100片', rxType: 'OTC', approvalNo: '国食健字G20110089', manufacturer: '汤臣倍健股份有限公司' },
  '1009': { id: '1009', name: '维生素C片', brand: '养生堂', spec: '100mg*100片', rxType: 'OTC', approvalNo: '国食健字G20080666', manufacturer: '养生堂药业有限公司' },
  '1010': { id: '1010', name: '维生素C咀嚼片', brand: '康恩贝', spec: '120片', rxType: 'OTC', approvalNo: '国食健字G20141234', manufacturer: '浙江康恩贝制药' },
  
  // Amoxicillin Mock Data for Smart Detection Scenario
  // 2001, 2002 are in an existing group (see above)
  '2001': { id: '2001', name: '阿莫西林胶囊', brand: '联邦', spec: '0.25g*24粒', rxType: 'Rx', approvalNo: '国药准字H20010111', manufacturer: '珠海联邦制药' },
  '2002': { id: '2002', name: '阿莫西林胶囊', brand: '华北制药', spec: '0.25g*50粒', rxType: 'Rx', approvalNo: '国药准字H20020222', manufacturer: '华北制药股份有限公司' },
  
  // 2005 is in a duplicate group
  '2005': { id: '2005', name: '阿莫西林胶囊', brand: '白云山', spec: '0.25g*10粒', rxType: 'Rx', approvalNo: '国药准字H20050999', manufacturer: '广州白云山制药' },

  // 2099 is in a similar group
  '2099': { id: '2099', name: '阿莫西林分散片', brand: '某药业', spec: '0.25g*20片', rxType: 'Rx', approvalNo: '国药准字H20999999', manufacturer: '某药业有限公司' },
  
  // 3001, 3002 are in the NEW application (see below)
  '3001': { id: '3001', name: '阿莫西林胶囊', brand: '葵花', spec: '0.25g*12粒', rxType: 'Rx', approvalNo: '国药准字H20030333', manufacturer: '葵花药业' },
  '3002': { id: '3002', name: '阿莫西林胶囊', brand: '仁和', spec: '0.25g*36粒', rxType: 'Rx', approvalNo: '国药准字H20040444', manufacturer: '仁和药业' },

  // 4001, 4002 are ORPHANS (Unmanaged, but same name/rxType)
  '4001': { id: '4001', name: '阿莫西林胶囊', brand: '罗欣', spec: '0.25g*48粒', rxType: 'Rx', approvalNo: '国药准字H20050555', manufacturer: '山东罗欣药业' },
  '4002': { id: '4002', name: '阿莫西林胶囊', brand: '鲁抗', spec: '0.25g*10粒', rxType: 'Rx', approvalNo: '国药准字H20060666', manufacturer: '山东鲁抗医药' },
};

// Initial Applications
export const INITIAL_APPLICATIONS: Application[] = [
  {
    id: 'sub-1',
    type: 'LINK',
    subject: '维生素C同品种关联',
    applicant: '张三',
    submittedAt: '2024/2/3 16:00:00',
    status: 'PENDING',
    productIds: ['1008', '1009'],
    reason: '这两个维生素C片产品属于同一种药品，品牌不同但成分和规格一致，申请关联管理。',
    images: []
  },
  {
    id: 'sub-2',
    type: 'LINK',
    subject: '阿莫西林同品种补录',
    applicant: '李四',
    submittedAt: '2024/2/5 09:30:00',
    status: 'PENDING',
    productIds: ['3001', '3002'],
    reason: '申请新增葵花和仁和的阿莫西林关联。',
    images: []
  }
];