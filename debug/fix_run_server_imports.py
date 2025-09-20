#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para corrigir imports do FDB no run_server.py
Execute: python fix_run_server_imports.py
"""

from pathlib import Path
import re

def fix_run_server_imports(base_dir: Path):
    """Corrige imports do fdb no run_server.py"""
    
    run_server_file = base_dir / "run_server.py"
    
    if not run_server_file.exists():
        print(f"Arquivo {run_server_file} não encontrado")
        return False
    
    try:
        # Lê conteúdo atual
        content = run_server_file.read_text(encoding='utf-8')
        print(f"Verificando {run_server_file}...")
        
        # Procura por imports do fdb
        fdb_imports = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            if 'import fdb' in line or 'from fdb' in line:
                fdb_imports.append((i, line.strip()))
        
        if not fdb_imports:
            print("Nenhum import do fdb encontrado no run_server.py")
            return True
        
        print("Imports do fdb encontrados:")
        for line_num, line in fdb_imports:
            print(f"  Linha {line_num}: {line}")
        
        # Substitui imports do fdb por firebird.driver
        new_content = content
        
        # Substituições
        replacements = [
            (r'import fdb', 'import firebird.driver as fdb'),
            (r'from fdb import', 'from firebird.driver import'),
        ]
        
        changes_made = []
        for old_pattern, new_pattern in replacements:
            if re.search(old_pattern, new_content):
                new_content = re.sub(old_pattern, new_pattern, new_content)
                changes_made.append(f"{old_pattern} → {new_pattern}")
        
        if changes_made:
            # Faz backup
            backup_file = run_server_file.with_suffix('.py.backup_fdb')
            run_server_file.rename(backup_file)
            print(f"Backup criado: {backup_file.name}")
            
            # Escreve versão corrigida
            run_server_file.write_text(new_content, encoding='utf-8')
            
            print("Alterações feitas:")
            for change in changes_made:
                print(f"  {change}")
            
            return True
        else:
            print("Nenhuma alteração necessária")
            return True
            
    except Exception as e:
        print(f"Erro ao corrigir run_server.py: {e}")
        return False

def create_corrected_run_server(base_dir: Path):
    """Cria uma versão completamente corrigida do run_server.py"""
    
    corrected_content = '''#!/usr/bin/env python3
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
    print("\\nTestando imports...")
    
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
    print("\\nVerificando arquivos...")
    
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
    print("\\nTestando conexão com banco...")
    
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
            print("\\n❌ Arquivos necessários faltando!")
            return False
        
        # 3. Testar imports
        if not test_imports():
            print("\\n❌ Erro nos imports!")
            return False
        
        # 4. Testar banco
        if not test_database_connection():
            print("\\n❌ Erro na conexão com banco!")
            print("Verifique se o Firebird está rodando e acessível")
            return False
        
        # 5. Importar e executar
        print("\\n🚀 Iniciando servidor...")
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
        print("\\n👋 Servidor interrompido pelo usuário")
        return True
    except ImportError as e:
        print(f"\\n❌ Erro de import: {e}")
        print("\\nVerifique se o driver firebird-driver está instalado:")
        print("pip install firebird-driver")
        return False
    except Exception as e:
        print(f"\\n❌ Erro inesperado: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
'''
    
    run_server_file = base_dir / "run_server.py"
    
    try:
        # Faz backup se existir
        if run_server_file.exists():
            backup_file = run_server_file.with_suffix('.py.backup_import')
            run_server_file.rename(backup_file)
            print(f"Backup criado: {backup_file.name}")
        
        # Escreve nova versão
        run_server_file.write_text(corrected_content, encoding='utf-8')
        print("run_server.py completamente reescrito")
        
        return True
        
    except Exception as e:
        print(f"Erro ao recriar run_server.py: {e}")
        return False

def main():
    """Função principal"""
    print("PSWEB Python - Correção do run_server.py")
    print("=" * 50)
    
    base_dir = Path(__file__).parent
    
    try:
        # Primeira tentativa: corrigir imports existentes
        if not fix_run_server_imports(base_dir):
            print("Tentativa de correção simples falhou...")
            
        # Segunda tentativa: recriar completamente
        print("\\nRecriando run_server.py completamente...")
        if create_corrected_run_server(base_dir):
            print("\\n✅ run_server.py corrigido com sucesso!")
            print("\\nAgora execute:")
            print("1. pip install firebird-driver")
            print("2. python run_server.py")
            return True
        else:
            print("\\n❌ Falha ao corrigir run_server.py")
            return False
        
    except Exception as e:
        print(f"\\n❌ Erro durante correção: {e}")
        return False

if __name__ == "__main__":
    main()