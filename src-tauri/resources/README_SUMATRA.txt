Coloque o arquivo "SumatraPDF.exe" nesta pasta:

  src-tauri/resources/SumatraPDF.exe

Por que:
- No MSI (PROD), o Smart Tech PDV imprime em modo estável:
  HTML -> PDF (Edge headless) -> Sumatra (silent print)
  Isso evita 'quebras' do WebView2/drivers e deixa DEV = PROD.

Observação:
- Se você não bundle o exe, o sistema ainda tenta usar um Sumatra instalado em:
  C:\Program Files\SumatraPDF\SumatraPDF.exe
  C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe
