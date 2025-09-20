@echo off
echo PSWEB Python - Iniciando Servidor
echo =====================================

REM Ativa ambiente virtual se existir
if exist .venv\Scripts\activate.bat (
    echo Ativando ambiente virtual...
    call .venv\Scripts\activate.bat
)

REM Inicia servidor
echo Iniciando servidor PSWEB...
python run_server.py

pause
