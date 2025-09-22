#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARQUIVO: backend/main_webview.py
PSWEB - Versão Desktop com PyWebView
"""

import webview
import threading
import time
import sys
from pathlib import Path

# Adiciona path do backend
sys.path.insert(0, str(Path(__file__).parent))

from app.main import app
import uvicorn

def start_server():
    """Inicia servidor FastAPI em background"""
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8000, 
        log_level="error",
        access_log=False
    )

def main():
    """Função principal"""
    print("🚀 Iniciando PSWEB Desktop...")
    
    # Inicia servidor em thread separada
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Aguarda servidor iniciar
    time.sleep(2)
    
    # Cria janela desktop
    webview.create_window(
        title="PSWEB - Passagem de Serviço",
        url="http://127.0.0.1:8000",
        width=1400,
        height=900,
        resizable=True,
        fullscreen=False,
        #debug=False  # Remove barra dev tools
    )
    
    print("✅ Abrindo interface desktop...")
    webview.start()

if __name__ == '__main__':
    main()