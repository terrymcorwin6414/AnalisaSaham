// index.js
// Node.js script: fetch harga IDX via yahoo-finance2 -> analisa -> simpan ke Supabase
import yf from 'yahoo-finance2';
import { createClient } from '@supabase/supabase-js';
import { EMA, RSI } from 'technicalindicators';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// utilities
const fmtDate = (d) => d.toISOString().slice(0,10);

async function upsertPrice(symbol, row) {
  // upsert price row by (symbol, date)
  const { error } = await supabase
    .from('prices')
    .upsert({
      symbol: symbol.toUpperCase(),
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume
    }, { onConflict: ['symbol', 'date'] });

  if (error) console.error('upsert price error', error);
}

async function insertAnalysis(priceId, rsi, macd, sma, ema) {
  const { error } = await supabase
    .from('analysis')
    .insert({
      price_id: priceId,
      rsi,
      macd,
      sma,
      ema
    });
  if (error) console.error('insert analysis error', error);
}

async function insertSignal(priceId, signalType, confidence, reason) {
  const { error } = await supabase
    .from('signals')
    .insert({
      price_id: priceId,
      signal_type: signalType,
      confidence,
      reason
    });
  if (error) console.error('insert signal error', error);
}

async function getPriceId(symbol, date) {
  const { data, error } = await supabase
    .from('prices')
    .select('id')
    .eq('symbol', symbol.toUpperCase())
    .eq('date', date)
    .limit(1)
    .single();

  if (error) {
    console.error('getPriceId error', error);
    return null;
  }
  return data.id;
}

async function processSymbol(symbol, period = '6mo', interval = '1d') {
  try {
    console.log(`Fetching ${symbol}.JK ...`);
    const hist = await yf.historical(symbol + '.JK', { period, interval });

    if (!hist || hist.length === 0) {
      console.warn(`No data for ${symbol}`);
      return;
    }

    // map to simple rows and upsert prices
    const rows = hist.map(r => ({
      date: fmtDate(new Date(r.date)),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume
    })).reverse(); // reverse so oldest -> newest

    // upsert all prices
    for (const row of rows) {
      await upsertPrice(symbol, row);
    }

    // prepare closes array (old -> new)
    const closes = rows.map(r => r.close).filter(v => v !== null && v !== undefined);
    if (closes.length < 20) {
      console.warn(`Insufficient data (need >=20 closes) for ${symbol}`);
      return;
    }

    // compute EMA20, EMA50, RSI14
    const ema20Series = EMA.calculate({ period: 20, values: closes });
    const ema50Series = EMA.calculate({ period: 50, values: closes });
    const rsi14Series = RSI.calculate({ period: 14, values: closes });

    const lastIndex = closes.length - 1;
    const lastEma20 = ema20Series[ema20Series.length - 1];
    const lastEma50 = ema50Series.length ? ema50Series[ema50Series.length - 1] : null;
    const lastRsi = rsi14Series[rsi14Series.length - 1];
    const lastDate = rows[rows.length -1].date;

    // get price_id
    const priceId = await getPriceId(symbol, lastDate);
    if (!priceId) {
      console.error('No price_id found, skipping', symbol, lastDate);
      return;
    }

    // insert analysis (macd/sma left null for now)
    await insertAnalysis(priceId, lastRsi ?? null, null, null, lastEma20 ?? null);

    // rule-based signal generation
    let signal = 'HOLD';
    let reason = 'No strong signal';
    let confidence = 50;

    if (lastEma20 != null && lastEma50 != null && lastRsi != null) {
      if (lastEma20 > lastEma50 && lastRsi > 50) {
        signal = 'BUY';
        reason = `EMA20 (${lastEma20.toFixed(2)}) > EMA50 (${lastEma50.toFixed(2)}), RSI ${lastRsi.toFixed(1)} > 50`;
        confidence = 80;
      } else if (lastEma20 < lastEma50 && lastRsi < 40) {
        signal = 'SELL';
        reason = `EMA20 (${lastEma20.toFixed(2)}) < EMA50 (${lastEma50.toFixed(2)}), RSI ${lastRsi.toFixed(1)} < 40`;
        confidence = 80;
      } else {
        if (lastEma20 > lastEma50) {
          signal = 'HOLD';
          reason = `Uptrend EMA20>EMA50 but RSI ${lastRsi.toFixed(1)} not confirming`;
          confidence = 60;
        } else {
          signal = 'HOLD';
          reason = `Downtrend EMA20<EMA50 but RSI ${lastRsi.toFixed(1)} not confirming`;
          confidence = 60;
        }
      }
    }

    await insertSignal(priceId, signal, confidence, reason);

    console.log(`Processed ${symbol} on ${lastDate}: ${signal} (${reason})`);
  } catch (err) {
    console.error('processSymbol error', symbol, err);
  }
}

// Example main: process list of symbols
async function main() {
  const symbolsEnv = process.env.SYMBOLS || 'BBCA,TLKM,BBRI';
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean);
  for (const s of symbols) {
    await processSymbol(s);
  }
  console.log('All done');
}

main();
