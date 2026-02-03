export type Role = 'BUSINESS' | 'COMPLIANCE';

export interface ProductDetail {
  id: string;
  name: string;
  brand: string;
  spec: string;
  rxType: 'OTC' | 'Rx';
  approvalNo: string;
  manufacturer: string;
}

export interface DrugGroup {
  id: string; // usually the main product ID
  name: string;
  productIds: string[];
  createdAt: string;
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Application {
  id: string;
  applicant: string;
  submittedAt: string;
  status: ApplicationStatus;
  productIds: string[];
  reason: string;
  images: string[]; // placeholder for image URLs
}
