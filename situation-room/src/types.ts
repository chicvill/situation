export type ViewMode = 'admin' | 'kitchen' | 'customer' | 'display' | 'store' | 'hr' | 'menu' | 'stats' | 'counter' | 'waiting' | 'qr';
export type BundleType = 'Menus' | 'PersonalInfos' | 'Orders' | 'Log' | 'Analysis' | 'StoreConfig' | 'Employee' | 'Attendance' | 'Waiting';

export interface BundleData {
  id: string;
  type: BundleType;
  title: string;
  items: any[];
  timestamp: string;
  status?: 'pending' | 'cooking' | 'ready' | 'served' | 'archived';
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  selection?: any;
}
