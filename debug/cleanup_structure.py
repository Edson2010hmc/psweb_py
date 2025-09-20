#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para limpar e reorganizar a estrutura bagunçada do PSWEB Python
Execute: python cleanup_structure.py
"""

import os
import shutil
from pathlib import Path
import sys

def backup_important_files(base_dir: Path):
    """Faz backup dos arquivos importantes antes da limpeza"""
    
    print("🔄 Fazendo backup de arquivos importantes...")
    backup_dir = base_dir / "backup_cleanup"
    backup_dir.mkdir(exist_ok=True)
    
    # Lista de arquivos importantes para preservar
    important_files = [
        "backend/app/backend/app/main.py",
        "backend/app/backend/app/config/settings.py", 
        "backend/app/backend/app/config/database.py",
        "backend/app/backend/app/models/fiscal.py",
        "backend/app/api/v1/fiscais.py",
        "backend/app/services/fiscal_service.py",
        "backend/app/services/auth_service.py",
        "backend/app/db/firebird_connection.py",
        "backend/requirements.txt",
        "backend/.env.example"
    ]
    
    backed_up = []
    
    for file_path in important_files:
        full_path = base_dir / file_path
        if full_path.exists() and full_path.is_file():
            # Cria estrutura no backup
            backup_file_path = backup_dir / file_path
            backup_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                shutil.copy2(full_path, backup_file_path)
                backed_up.append(file_path)
                print(f"  ✓ {file_path}")
            except Exception as e:
                print(f"  ✗ Erro ao fazer backup de {file_path}: {e}")
    
    print(f"📁 Backup criado em: {backup_dir}")
    print(f"📄 {len(backed_up)} arquivos salvos")
    return backup_dir, backed_up

def clean_nested_structure(base_dir: Path):
    """Remove a estrutura aninhada incorreta"""
    
    print("\n🧹 Limpando estrutura aninhada...")
    
    # Remove o diretório aninhado incorreto
    nested_backend = base_dir / "backend/app/backend"
    if nested_backend.exists():
        try:
            shutil.rmtree(nested_backend)
            print(f"  ✓ Removido: {nested_backend}")
        except Exception as e:
            print(f"  ✗ Erro ao remover {nested_backend}: {e}")
            return False
    
    # Remove arquivos soltos que estão fora do lugar
    files_to_remove = [
        "backend/app/check_setup.py",
        "backend/app/fix_setup.py", 
        "backend/app/run_server.py",
        "backend/app/models/verify_structure.py"
    ]
    
    for file_path in files_to_remove:
        full_path = base_dir / file_path
        if full_path.exists():
            try:
                full_path.unlink()
                print(f"  ✓ Removido arquivo solto: {file_path}")
            except Exception as e:
                print(f"  ✗ Erro ao remover {file_path}: {e}")
    
    return True

def recreate_correct_structure(base_dir: Path, backup_dir: Path):
    """Recria a estrutura correta a partir do backup"""
    
    print("\n🏗️  Recriando estrutura correta...")
    
    # Estrutura correta
    correct_structure = {
        "backend/app": {},
        "backend/app/config": {},
        "backend/app/models": {},
        "backend/app/services": {},
        "backend/app/api": {},
        "backend/app/api/v1": {},
        "backend/app/utils": {},
        "backend/app/db": {}
    }
    
    # Cria diretórios
    for dir_path in correct_structure.keys():
        full_path = base_dir / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
        print(f"  📁 {dir_path}")
    
    # Cria arquivos __init__.py necessários
    init_files = [
        "backend/app/__init__.py",
        "backend/app/config/__init__.py", 
        "backend/app/models/__init__.py",
        "backend/app/services/__init__.py",
        "backend/app/api/__init__.py",
        "backend/app/api/v1/__init__.py",
        "backend/app/utils/__init__.py",
        "backend/app/db/__init__.py"
    ]
    
    for init_path in init_files:
        full_path = base_dir / init_path
        if not full_path.exists():
            full_path.write_text("# Módulo Python\n", encoding='utf-8')
            print(f"  📄 {init_path}")

def restore_files_from_backup(base_dir: Path, backup_dir: Path):
    """Restaura arquivos do backup para a estrutura correta"""
    
    print("\n📋 Restaurando arquivos do backup...")
    
    # Mapeamento: arquivo_backup -> local_correto
    file_mapping = {
        "backend/app/backend/app/main.py": "backend/app/main.py",
        "backend/app/backend/app/config/settings.py": "backend/app/config/settings.py",
        "backend/app/backend/app/config/database.py": "backend/app/config/database.py", 
        "backend/app/backend/app/models/fiscal.py": "backend/app/models/fiscal.py",
        "backend/app/api/v1/fiscais.py": "backend/app/api/v1/fiscais.py",
        "backend/app/services/fiscal_service.py": "backend/app/services/fiscal_service.py",
        "backend/app/services/auth_service.py": "backend/app/services/auth_service.py",
        "backend/app/db/firebird_connection.py": "backend/app/db/firebird_connection.py"
    }
    
    restored = 0
    
    for backup_path, correct_path in file_mapping.items():
        backup_file = backup_dir / backup_path
        correct_file = base_dir / correct_path
        
        if backup_file.exists():
            try:
                # Cria diretório pai se necessário
                correct_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(backup_file, correct_file)
                print(f"  ✓ {correct_path}")
                restored += 1
            except Exception as e:
                print(f"  ✗ Erro ao restaurar {correct_path}: {e}")
        else:
            print(f"  ⚠ Backup não encontrado: {backup_path}")
    
    print(f"📄 {restored} arquivos restaurados")

def create_missing_files(base_dir: Path):
    """Cria arquivos que podem estar faltando"""
    
    print("\n📝 Criando arquivos essenciais faltantes...")
    
    # Arquivo principal main.py se não existir
    main_py = base_dir / "backend/app/main.py"
    if not main_py.exists() or main_py.stat().st_size < 100:
        main_content = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWEB Python - Aplicação Principal
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config.settings import settings
from app.config.database import init_database

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PSWEB - Passagem de Serviço",
    description="Sistema de Passagem de Serviço - Fiscalização",
    version="2.0.0"
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers quando existirem
try:
    from app.api.v1 import fiscais
    app.include_router(fiscais.router)
    logger.info("Router de fiscais carregado")
except ImportError:
    logger.warning("Router de fiscais não encontrado")

@app.get("/")
async def root():
    return {"message": "PSWEB Python API", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok", "database": "checking..."}

@app.on_event("startup")
async def startup_event():
    logger.info("Iniciando PSWEB Python API...")
    try:
        await init_database()
        logger.info("Banco conectado com sucesso")
    except Exception as e:
        logger.error(f"Erro ao conectar banco: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
'''
        main_py.write_text(main_content, encoding='utf-8')
        print(f"  ✓ main.py criado")
    
    # Arquivo settings.py básico se não existir
    settings_py = base_dir / "backend/app/config/settings.py"
    if not settings_py.exists():
        settings_content = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configurações da aplicação
"""

class Settings:
    # Banco Firebird
    DB_HOST = "127.0.0.1"
    DB_PORT = 3050
    DB_NAME = r"C:\\Users\\Public\\Firebird-4.0.5.3140-0-x64\\psweb_data\\PSWEB.FDB"
    DB_USER = "SYSDBA"
    DB_PASS = "masterkey"
    
    # Servidor
    HOST = "127.0.0.1"
    PORT = 8000
    DEBUG = True
    
    # App
    SECRET_KEY = "change-me"
    USE_WINDOWS_AUTH = True

settings = Settings()
'''
        settings_py.write_text(settings_content, encoding='utf-8')
        print(f"  ✓ settings.py criado")

def verify_final_structure(base_dir: Path):
    """Verifica se a estrutura final está correta"""
    
    print("\n🔍 Verificando estrutura final...")
    
    required_files = [
        "backend/app/main.py",
        "backend/app/__init__.py", 
        "backend/app/config/__init__.py",
        "backend/app/config/settings.py",
        "backend/app/models/__init__.py",
        "backend/app/services/__init__.py",
        "backend/app/api/__init__.py",
        "backend/app/api/v1/__init__.py"
    ]
    
    missing = []
    existing = []
    
    for file_path in required_files:
        full_path = base_dir / file_path
        if full_path.exists():
            existing.append(file_path)
        else:
            missing.append(file_path)
    
    print(f"  ✓ Existem: {len(existing)} arquivos")
    if missing:
        print(f"  ✗ Faltando: {len(missing)} arquivos")
        for f in missing:
            print(f"    - {f}")
    
    # Verifica se não há mais estrutura aninhada
    nested_check = base_dir / "backend/app/backend"
    if nested_check.exists():
        print("  ⚠ ATENÇÃO: Ainda há estrutura aninhada!")
        return False
    else:
        print("  ✓ Estrutura aninhada removida")
    
    return len(missing) == 0

def main():
    """Função principal"""
    print("PSWEB Python - Limpeza e Reorganização da Estrutura")
    print("=" * 70)
    
    base_dir = Path(__file__).parent
    print(f"Diretório: {base_dir}")
    
    try:
        # 1. Backup dos arquivos importantes
        backup_dir, backed_up = backup_important_files(base_dir)
        
        if not backed_up:
            print("❌ Nenhum arquivo foi salvo no backup!")
            return False
        
        # 2. Limpeza da estrutura aninhada
        if not clean_nested_structure(base_dir):
            print("❌ Falha na limpeza!")
            return False
        
        # 3. Recriação da estrutura correta
        recreate_correct_structure(base_dir, backup_dir)
        
        # 4. Restauração dos arquivos
        restore_files_from_backup(base_dir, backup_dir)
        
        # 5. Criação de arquivos faltantes
        create_missing_files(base_dir)
        
        # 6. Verificação final
        success = verify_final_structure(base_dir)
        
        print("\n" + "=" * 70)
        if success:
            print("🎉 ESTRUTURA REORGANIZADA COM SUCESSO!")
            print("\nPróximos passos:")
            print("1. python list_structure.py    # Verificar nova estrutura")
            print("2. python run_server.py        # Testar servidor")
        else:
            print("⚠️  Estrutura reorganizada com algumas pendências")
            print("Verifique os itens faltantes acima")
        
        print(f"\n💾 Backup mantido em: {backup_dir}")
        print("   (pode ser removido após confirmar que tudo funciona)")
        
        return success
        
    except Exception as e:
        print(f"\n❌ Erro durante reorganização: {e}")
        return False

if __name__ == "__main__":
    main()