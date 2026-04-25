export type ViewMode = 'admin' | 'kitchen' | 'customer' | 'display' | 'store' | 'hr' | 'menu' | 'stats' | 'counter' | 'waiting' | 'qr';
export type BundleType = 'Menus' | 'PersonalInfos' | 'Orders' | 'Log' | 'Analysis' | 'StoreConfig' | 'Employee' | 'Attendance' | 'Waiting';

export interface BundleItem {
  name: string;
  value: string;
}

export interface BundleData {
  id: string;
  type: BundleType;
  title: string;
  items: BundleItem[];
  timestamp: string;
  status?: 'pending' | 'cooking' | 'ready' | 'served' | 'archived';
  order_code?: string;
  table?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  selection?: any;
}
