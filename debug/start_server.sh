#!/bin/bash
echo "PSWEB Python - Iniciando Servidor"
echo "====================================="

# Ativa ambiente virtual se existir
if [ -f ".venv/bin/activate" ]; then
    echo "Ativando ambiente virtual..."
    source .venv/bin/activate
fi

# Inicia servidor
echo "Iniciando servidor PSWEB..."
python run_server.py
