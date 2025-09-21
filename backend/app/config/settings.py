#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARQUIVO: backend/app/config/settings.py
Configurações da aplicação PSWEB Python
"""

import os
from pathlib import Path
from typing import Optional

class Settings:
    """Configurações da aplicação"""
    
    # Banco de dados Firebird
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3050
    DB_NAME: str = r"C:\Users\Public\Firebird-4.0.5.3140-0-x64\psweb_data\PSWEB.FDB"
    DB_USER: str = "SYSDBA"
    DB_PASS: str = "masterkey"
    
    # Aplicação
    SECRET_KEY: str = "change-me-in-production"
    USE_WINDOWS_AUTH: bool = True  # SEMPRE True - sistema requer autenticação Windows
    STORAGE_DIR: str = "../storage"
    
    # === CONFIGURAÇÃO DE AUTENTICAÇÃO ===
    # Define qual campo será comparado com USERNAME do Windows
    # Valores aceitos: "NOME" ou "CHAVE"
    AUTH_FIELD: str = "NOME"  # Padrão: compara com o campo NOME
    
    # === CONFIGURAÇÃO DE DEBUG ===
    # Habilita rotas de debug e logs extras
    DEBUG: bool = True
    DEBUG_AUTH: bool = True  # NOVO: Habilita rotas de debug específicas de autenticação
    DEBUG_ROUTES: bool = True  # NOVO: Habilita log detalhado de rotas
    
    # Servidor
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # PDF
    PDF_LOGO: Optional[str] = None
    
    def __init__(self):
        """Carrega configurações do arquivo .env se existir"""
        env_file = Path(__file__).parent.parent.parent / ".env"
        if env_file.exists():
            self._load_env_file(env_file)
    
    def _load_env_file(self, env_file: Path):
        """Carrega variáveis do arquivo .env"""
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Remove aspas se existirem
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        
                        # Aplica as configurações
                        if hasattr(self, key):
                            # Converte tipos conforme necessário
                            if key in ['DB_PORT', 'PORT']:
                                value = int(value)
                            elif key in ['USE_WINDOWS_AUTH', 'DEBUG', 'DEBUG_AUTH', 'DEBUG_ROUTES']:
                                value = value.lower() in ['true', '1', 'yes']
                            elif key == 'AUTH_FIELD':
                                # Valida valores aceitos para AUTH_FIELD
                                if value.upper() in ['NOME', 'CHAVE']:
                                    value = value.upper()
                                else:
                                    print(f"Aviso: AUTH_FIELD inválido '{value}', usando padrão 'NOME'")
                                    value = 'NOME'
                            
                            setattr(self, key, value)
        except Exception as e:
            print(f"Aviso: Erro ao carregar .env: {e}")

# Instância global das configurações
settings = Settings()