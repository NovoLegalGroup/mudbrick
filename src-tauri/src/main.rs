//! Mudbrick v2 -- Main Entry Point
//!
//! Tauri desktop shell entry point.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mudbrick_lib::run();
}
