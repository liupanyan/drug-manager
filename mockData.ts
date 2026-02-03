import { DrugGroup, ProductDetail, Application } from './types';

// Existing groups shown in Image 1
export const INITIAL_DRUG_GROUPS: DrugGroup[] = [
  { id: '251', name: '999 六味地黄丸', productIds: ['251', '3654826'], createdAt: '2023-01-01' },
  { id: '451', name: '九芝堂 杞菊地黄丸', productIds: ['451', '1262563'], createdAt: '2023-02-15' },
  { id: '672', name: '江西民济 全鹿丸', productIds: ['672', '910291'], createdAt: '2023-03-10' },
  { id: '674', name: '白云山 花城 龟鹿补肾丸', productIds: ['674', '1605383'], createdAt: '2023-04-05' },
  { id: '1032', name: '森科源 复方黄连素片', productIds: ['1032', '3875884'], createdAt: '2023-05-20' },
  { id: '1414', name: '999 小儿氨酚黄那敏颗粒', productIds: ['1414', '449286', '3443006'], createdAt: '2023-06-12' },
];

// Mock Database of Products (used for "System Auto Pull" feature)
export const MOCK_PRODUCT_DB: Record<string, ProductDetail> = {
  '1001': { id: '1001', name: '阿莫西林胶囊', brand: '修正', spec: '0.25g*24粒', rxType: 'Rx', approvalNo: '国药准字H22022567', manufacturer: '修正药业集团股份有限公司' },
  '1002': { id: '1002', name: '阿莫西林胶囊', brand: '石药', spec: '0.25g*20粒', rxType: 'Rx', approvalNo: '国药准字H13021750', manufacturer: '石药集团有限公司' },
  '1003': { id: '1003', name: '阿莫西林胶囊', brand: '白云山', spec: '0.25g*30粒', rxType: 'Rx', approvalNo: '国药准字H44021234', manufacturer: '广州白云山制药' },
  '1008': { id: '1008', name: '维生素C片', brand: '汤臣倍健', spec: '100mg*100片', rxType: 'OTC', approvalNo: '国食健字G20110089', manufacturer: '汤臣倍健股份有限公司' },
  '1009': { id: '1009', name: '维生素C片', brand: '养生堂', spec: '100mg*100片', rxType: 'OTC', approvalNo: '国食健字G20080666', manufacturer: '养生堂药业有限公司' },
  '1010': { id: '1010', name: '维生素C咀嚼片', brand: '康恩贝', spec: '120片', rxType: 'OTC', approvalNo: '国食健字G20141234', manufacturer: '浙江康恩贝制药' },
};

// Initial Applications
export const INITIAL_APPLICATIONS: Application[] = [
  {
    id: 'sub-1',
    applicant: '张三',
    submittedAt: '2024/2/3 16:00:00',
    status: 'PENDING',
    productIds: ['1008', '1009'],
    reason: '这两个维生素C片产品属于同一种药品，品牌不同但成分和规格一致，申请关联管理。',
    images: []
  }
];
