-- ============================================
-- Logística Hogareño - Supabase Migration
-- Ejecutar este SQL en el SQL Editor de Supabase
-- ============================================

-- 1. Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Tabla de bultos (paquetes/stock)
CREATE TABLE IF NOT EXISTS bultos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  description text,
  barcode text UNIQUE,
  status text NOT NULL DEFAULT 'stored' CHECK (status IN ('stored', 'scheduled_return', 'returned', 'deleted')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_return_date date,
  actual_return_date date,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Tabla de eventos de agenda
CREATE TABLE IF NOT EXISTS agenda_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'return' CHECK (event_type IN ('return', 'pickup', 'other')),
  scheduled_date date NOT NULL,
  notes text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 4. Tabla de alertas de stock
CREATE TABLE IF NOT EXISTS stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulto_id uuid NOT NULL REFERENCES bultos(id) ON DELETE CASCADE,
  alert_type text NOT NULL DEFAULT 'old_stock' CHECK (alert_type IN ('old_stock', 'capacity', 'other')),
  message text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_bultos_client_id ON bultos(client_id);
CREATE INDEX IF NOT EXISTS idx_bultos_status ON bultos(status);
CREATE INDEX IF NOT EXISTS idx_bultos_barcode ON bultos(barcode);
CREATE INDEX IF NOT EXISTS idx_bultos_deleted_at ON bultos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON agenda_events(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_agenda_events_client_id ON agenda_events(client_id);

-- 6. Función RPC: Top clientes por volumen
CREATE OR REPLACE FUNCTION get_top_clients(limit_count int DEFAULT 5)
RETURNS TABLE(id uuid, name text, notes text, bultos_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.name,
    c.notes,
    COUNT(b.id) AS bultos_count
  FROM clients c
  LEFT JOIN bultos b ON b.client_id = c.id AND b.deleted_at IS NULL AND b.status = 'stored'
  WHERE c.deleted_at IS NULL
  GROUP BY c.id, c.name, c.notes
  HAVING COUNT(b.id) > 0
  ORDER BY bultos_count DESC
  LIMIT limit_count;
$$;

-- 7. Función RPC: Stock más antiguo
CREATE OR REPLACE FUNCTION get_oldest_stock(limit_count int DEFAULT 5)
RETURNS TABLE(id uuid, client_name text, entry_date date)
LANGUAGE sql STABLE
AS $$
  SELECT
    b.id,
    c.name AS client_name,
    b.entry_date
  FROM bultos b
  JOIN clients c ON c.id = b.client_id
  WHERE b.deleted_at IS NULL AND b.status = 'stored'
  ORDER BY b.entry_date ASC
  LIMIT limit_count;
$$;

-- 8. Habilitar RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bultos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- 9. Políticas RLS (acceso completo para usuarios autenticados)
CREATE POLICY "Authenticated full access" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON bultos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON agenda_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON stock_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
