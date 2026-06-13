// ============================================================
//  Smart Tech PDV — Entry Point (Windows GUI + Console Guard)
// ============================================================
//
//  #![windows_subsystem = "windows"]
//  ↑ Diretiva que instrui o linker MSVC/MinGW a marcar o PE
//  com IMAGE_SUBSYSTEM_WINDOWS_GUI (subsistema 2) em vez de
//  IMAGE_SUBSYSTEM_WINDOWS_CUI (subsistema 3).
//
//  Efeito prático:
//    - Release build: Windows NÃO aloca uma janela de console
//      ao iniciar o processo. O app abre diretamente na GUI.
//    - Debug build:   cfg(debug_assertions) é verdadeiro, então
//      o atributo é IGNORADO — console permanece disponível
//      para println!, dbg!, log::debug!, etc.
//
//  Por que colocar em main.rs e NÃO em lib.rs?
//    O atributo #![windows_subsystem] só é honrado pelo linker
//    quando está no crate raiz do executável (main.rs).
//    Em lib.rs ele é silenciosamente ignorado.
//
//  Referência: https://doc.rust-lang.org/reference/runtime.html
//              #the-windows_subsystem-attribute

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    smart_tech_pdv_lib::run();
}
