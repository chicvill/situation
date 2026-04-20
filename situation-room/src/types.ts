export type BundleType = 'Menus' | 'PersonalInfos' | 'Orders' | 'Log';

export interface BundleData {
  id: string;
  type: BundleType;
  title: string;
  items: any[];
  timestamp: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}
