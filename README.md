# Analisa Saham IDX (Auto)

Files:
- index.js : script utama untuk fetch, analisa, dan simpan ke Supabase
- sql/init_tables.sql : SQL buat tabel di Supabase
- .env.example : contoh environment variables

## Cara pakai (tanpa install di lokal)
1. Buat project Supabase, jalankan SQL (`sql/init_tables.sql`) di SQL Editor.
2. Buat repo GitHub, tambahkan file2 ini (bisa pakai "Create new file" di GitHub).
3. Buka Gitpod:
   - di browser: https://gitpod.io/#https://github.com/your-username/your-repo
4. Di Gitpod terminal:
   ```bash
   npm install
   # set env vars di Gitpod workspace settings OR create a .env file:
   # SUPABASE_URL, SUPABASE_SERVICE_KEY, SYMBOLS
   npm start
