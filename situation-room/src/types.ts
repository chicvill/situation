export type ViewMode = 'admin' | 'kitchen' | 'customer' | 'display' | 'store' | 'hr' | 'menu' | 'stats' | 'counter' | 'waiting' | 'qr';
export type BundleType = 'Menus' | 'PersonalInfos' | 'Orders' | 'Log' | 'Analysis' | 'StoreConfig' | 'Employee' | 'Attendance' | 'Waiting' | 'Checkins';

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
  status?: 'pending' | 'cooking' | 'ready' | 'served' | 'archived' | 'canceled' | 'paid' | 'approved';
  order_code?: string;
  table?: string;
  payment?: string;
  device_id?: string;
  store_id?: string;
  store?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  selection?: any;
}
