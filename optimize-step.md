## Rekap Review Codebase Bot WA/Telegram (Node.js)

### Temuan Utama (urut severity)

1. **Critical - Potensi command injection di fitur exec script**
- Lokasi: script.ts, script.ts, script.ts
- Masalah: command dibangun sebagai string shell lalu dieksekusi dengan `exec`. Validasi blacklist token sangat mudah di-bypass dengan chaining shell (`;`, `&&`, `$()`, redirect, quoting).
- Dampak: Remote Code Execution dari chat command.
- Saran: ganti ke `spawn` tanpa shell (`shell: false`), allowlist executable + arg parser ketat, batasi path ke direktori script, drop fitur arbitrary command untuk non-owner.

2. **High - Load environment bisa salah urutan untuk exposed API key**
- Lokasi: index.ts, index.ts, exposed.ts
- Masalah: `EXPOSED_API_KEY` dibaca saat module load, tapi `dotenv.config()` dipanggil setelah import modul exposed.
- Dampak: endpoint bisa terus menganggap key tidak terkonfigurasi walau ada di .env (tergantung cara startup env).
- Saran: baca env di dalam request-time function, atau panggil `dotenv.config()` sebelum import yang mengakses env.

3. **High - Reconnect flow rawan crash / race**
- Lokasi: index.ts, index.ts, index.ts, index.ts
- Masalah:
  - `rmdirSync(AUTH_DIR)` tanpa guard/recursive bisa throw.
  - `startSock()` dipanggil berulang tanpa await/backoff.
  - `initializeBrowser()` dipanggil tanpa await.
- Dampak: reconnect storm, startup race, proses mati saat logout/re-auth.
- Saran: gunakan retry manager (exponential backoff + jitter + single-flight lock), pakai async remove yang aman, await browser init.

4. **Medium - Endpoint exposed kurang defensive terhadap runtime error**
- Lokasi: exposed.ts, exposed.ts, exposed.ts
- Masalah: `c.req.json()` dan `sendMessage` tidak dibungkus error boundary terstruktur.
- Dampak: 500 tanpa format konsisten, observability rendah, client sulit recovery.
- Saran: schema validation (zod/joi), try-catch global middleware, response envelope standar (`code`, `message`, `details`, `requestId`).

5. **Medium - Throughput bottleneck pada message processing**
- Lokasi: handler.ts, handler.ts
- Masalah:
  - Loop message diproses serial (`await` per item).
  - Raw message di-log penuh via `util.inspect(..., depth null)`.
- Dampak: latency naik saat burst message, CPU/IO log berat, risiko block event loop.
- Saran: pakai bounded concurrency queue (mis. `p-limit`), sampling log + ringkas field penting saja.

6. **Medium - Beberapa async task interval/cron belum punya guard error konsisten**
- Lokasi: store.ts, reminder.ts, reminder.ts
- Masalah: pemanggilan async periodik tanpa pattern `safeExecute` (try-catch + retry + metrics) di level scheduler.
- Dampak: error intermittent sulit ditrace; potensi unhandled rejection tergantung runtime path.
- Saran: bungkus job dengan helper standar `runSafely(jobName, fn)` dan kirim telemetry.

7. **Medium - Tipe kolom reminder kurang portable untuk sqlite**
- Lokasi: reminder.ts
- Masalah: `DataTypes.JSONB` dipakai pada dialect sqlite.
- Dampak: portability rendah, behavior bisa beda antar environment.
- Saran: gunakan `JSON`/`TEXT` + serializer eksplisit untuk sqlite.

8. **Low - Coverage test masih sangat sempit**
- Lokasi: jest.config.js
- Fakta: test yang jalan hanya suite reminder kecil; jalur kritikal command, reconnect, exposed API belum teruji.
- Dampak: regresi mudah lolos.
- Saran: tambah integration tests untuk handler pipeline, exposed API auth/validation, dan reconnect scenario.

---

### Komentar Arsitektur Singkat

- Struktur modul command sudah rapi dan extensible (pattern registry pada handler/menu) di handler.ts.
- Ada usaha caching metadata dan config debouncing yang bagus untuk efisiensi di index.ts dan ConfigManager.ts.
- Tantangan utama sekarang bukan fitur, tapi hardening reliability + security pada command execution, reconnect lifecycle, dan API boundary.

---

### Langkah Optimasi yang Paling Berdampak (prioritas eksekusi)

1. **Security hardening dulu**
- Matikan sementara command exec raw.
- Refactor ke allowlist + spawn no-shell.
- Audit command sensitif owner-only.

2. **Stabilisasi lifecycle koneksi**
- Tambah reconnect coordinator (single instance lock + backoff).
- Perbaiki auth dir cleanup yang aman.
- Await dependency init wajib.

3. **Naikkan performa handler**
- Terapkan queue bounded concurrency untuk message upsert.
- Ubah log raw full jadi structured log ringkas + sampling.

4. **Perkuat API boundary**
- Validation schema untuk payload.
- Error middleware terstandar.
- Tambah timeout + retry policy outbound message.

5. **Reliability async jobs**
- Bungkus semua cron/interval dengan guard + observability.
- Tambah dead-letter/retry strategy untuk reminder send fail.

---

### Error Handling yang Disarankan (template operasional)

- Gunakan klasifikasi error: `ValidationError`, `ExternalServiceError`, `TransientError`, `FatalError`.
- Semua boundary async pakai pola:
  - validate input
  - execute
  - map error ke response/user message
  - log structured (`event`, `chatId`, `cmd`, `requestId`, `stack`)
- Untuk command user:
  - tampilkan pesan user-friendly
  - simpan detail teknis hanya di log internal
- Untuk job background:
  - no throw ke top-level scheduler
  - retry terbatas + circuit breaker untuk service eksternal
- Untuk proses utama:
  - handler `uncaughtException` dan `unhandledRejection` dengan graceful shutdown.

---

### Verifikasi yang saya jalankan

- Menjalankan test default: semua test yang ada lulus (1 suite, 7 test).
- Menjalankan `pnpm test -- --runInBand` awalnya tidak tepat karena argumen diperlakukan sebagai pattern, jadi terlihat “No tests found”.

---

Jika kamu mau, saya bisa lanjut tahap berikutnya: saya patch langsung 3 isu tertinggi dulu (exec hardening, env load order exposed API, reconnect manager) dalam satu PR-style perubahan yang kecil dan aman.