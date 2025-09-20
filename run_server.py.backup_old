#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script corrigido para executar o servidor PSWEB Python
"""

import sys
import os
from pathlib import Path

def setup_python_path():
    """Configura o PYTHONPATH para a estrutura correta"""
    base_dir = Path(__file__).parent
    backend_dir = base_dir / "backend"
    
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    print(f"Python path configurado:")
    print(f"  Base: {base_dir}")
    print(f"  Backend: {backend_dir}")
    
    return backend_dir

def test_imports():
    """Testa se os imports principais funcionam"""
    print("\nTestando imports...")
    
    try:
        # Testa FastAPI
        import fastapi
        print("  ✓ FastAPI disponível")
        
        # Testa uvicorn
        import uvicorn
        print("  ✓ Uvicorn disponível")
        
        # Testa Firebird driver
        import firebird.driver
        print("  ✓ Firebird driver disponível")
        
        # Testa se consegue importar o app
        from app.main import app
        print("  ✓ App principal importado")
        
        return True
        
    except ImportError as e:
        print(f"  ✗ Erro de import: {e}")
        return False
    except Exception as e:
        print(f"  ✗ Erro inesperado: {e}")
        return False

def check_files():
    """Verifica se os arquivos necessários existem"""
    print("\nVerificando arquivos...")
    
    base_dir = Path(__file__).parent
    required_files = [
        "backend/app/main.py",
        "backend/app/config/settings.py",
        "backend/app/config/database.py"
    ]
    
    missing = []
    for file_path in required_files:
        full_path = base_dir / file_path
        if full_path.exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} (FALTANDO)")
            missing.append(file_path)
    
    return len(missing) == 0

def test_database_connection():
    """Testa conexão com o banco"""
    print("\nTestando conexão com banco...")
    
    try:
        from app.config.database import db
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM RDB$DATABASE")
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result:
            print("  ✓ Conexão com banco OK")
            return True
        else:
            print("  ✗ Erro na query de teste")
            return False
            
    except Exception as e:
        print(f"  ✗ Erro na conexão: {e}")
        return False

def main():
    """Função principal"""
    print("PSWEB Python - Iniciando Servidor")
    print("=" * 50)
    
    try:
        # 1. Configurar Python path
        backend_dir = setup_python_path()
        
        # 2. Verificar arquivos
        if not check_files():
            print("\n❌ Arquivos necessários faltando!")
            return False
        
        # 3. Testar imports
        if not test_imports():
            print("\n❌ Erro nos imports!")
            return False
        
        # 4. Testar banco
        if not test_database_connection():
            print("\n❌ Erro na conexão com banco!")
            print("Verifique se o Firebird está rodando e acessível")
            return False
        
        # 5. Importar e executar
        print("\n🚀 Iniciando servidor...")
        from app.main import app
        from app.config.settings import settings
        import uvicorn
        
        print(f"Servidor: http://{settings.HOST}:{settings.PORT}")
        print(f"Documentação: http://{settings.HOST}:{settings.PORT}/docs")
        print("Pressione Ctrl+C para parar")
        
        uvicorn.run(
            app,
            host=settings.HOST,
            port=settings.PORT,
            reload=settings.DEBUG,
            log_level="info"
        )
        
        return True
        
    except KeyboardInterrupt:
        print("\n👋 Servidor interrompido pelo usuário")
        return True
    except ImportError as e:
        print(f"\n❌ Erro de import: {e}")
        print("\nVerifique se o driver firebird-driver está instalado:")
        print("pip install firebird-driver")
        return False
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
