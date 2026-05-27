export interface BundleItem {
  name: string;
  value: string;
}

export interface Bundle {
  id: string;
  type: string;
  title?: string;
  store?: string;
  store_id?: string;
  status?: string;
  items?: BundleItem[];
  timestamp?: string;
}

export interface ScheduleEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface EmployeeDetail {
  id: string;
  name: string;
  role: string;
  wage: string;
  hours: string;
  cumulativeWage: string;
  paidWage: string;
  unpaidWage: string;
  contract: {
    start?: string;
    end?: string;
    gender?: string;
    birth_date?: string;
    employment_type?: string;
    severance_eligible?: string;
  };
  schedule: ScheduleEntry[];
  rawBundle: Bundle;
}

export interface PayrollInfo {
  id: string;
  name: string;
  role: string;
  wage: string;
  hours: string;
  cumulativeWage: string;
  paidWage: string;
  unpaidWage: string;
}
