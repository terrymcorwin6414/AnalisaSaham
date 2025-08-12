-- Tabel harga saham harian IDX
CREATE TABLE IF NOT EXISTS prices (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC(12,2),
  high NUMERIC(12,2),
  low NUMERIC(12,2),
  close NUMERIC(12,2),
  volume BIGINT,
  UNIQUE(symbol, date)
);

-- Tabel hasil analisa teknikal
CREATE TABLE IF NOT EXISTS analysis (
  id BIGSERIAL PRIMARY KEY,
  price_id BIGINT NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  rsi NUMERIC(5,2),
  macd NUMERIC(8,4),
  sma NUMERIC(8,4),
  ema NUMERIC(8,4),
  pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel sinyal trading
CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  price_id BIGINT NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  signal_type TEXT CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
  confidence NUMERIC(5,2),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
