Fix: tauri-plugin-rusqlite2 compiling errors (load_extension_* not found) + avoid OpenSSL vendored build.

What it does:
- Sets tauri-plugin-rusqlite2 with default-features = false and features = ["bundled"]
  This disables SQLCipher/OpenSSL vendored and disables extension-loading API.

Apply:
- Extract this zip at the project root and overwrite.
- Then delete src-tauri\Cargo.lock and src-tauri\target (if they exist) and build again.

Commands (PowerShell):
  Remove-Item -Recurse -Force .\src-tauri\target -ErrorAction SilentlyContinue
  Remove-Item -Force .\src-tauri\Cargo.lock -ErrorAction SilentlyContinue
  npm run build:desktop
