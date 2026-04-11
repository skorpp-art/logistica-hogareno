export interface Client {
  id: string;
  name: string;
  nombre_fantasia: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bulto {
  id: string;
  client_id: string;
  description: string | null;
  barcode: string | null;
  tracking_id: string | null;
  status: "stored" | "scheduled_return" | "returned" | "deleted" | "cancelled" | "duplicate" | "cambio" | "devolucion" | "rechazado" | "ficha";
  entry_date: string;
  scheduled_return_date: string | null;
  actual_return_date: string | null;
  destination_address: string | null;
  destination_locality: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaEvent {
  id: string;
  client_id: string;
  event_type: "return" | "pickup" | "other";
  scheduled_date: string;
  notes: string | null;
  completed: boolean;
  created_at: string;
}

export interface StockAlert {
  id: string;
  bulto_id: string;
  alert_type: "old_stock" | "capacity" | "other";
  message: string | null;
  resolved: boolean;
  created_at: string;
}

export interface WeeklySchedule {
  id: string;
  client_id: string;
  dom: boolean;
  lun: boolean;
  mar: boolean;
  mie: boolean;
  jue: boolean;
  vie: boolean;
  sab: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_stock: number;
  total_clients: number;
  stock_alerts: number;
  papelera_count: number;
}

export interface TopClient {
  id: string;
  name: string;
  notes: string | null;
  bultos_count: number;
}

export interface OldestStockItem {
  id: string;
  client_name: string;
  entry_date: string;
}
