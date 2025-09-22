#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para encontrar e corrigir imports incorretos nos arquivos Python
Execute: python fix_imports.py
"""

import os
import re
from pathlib import Path

def scan_for_bad_imports(base_dir: Path):
    """Escaneia todos os arquivos Python em busca de imports incorretos"""
    
    print("🔍 Escaneando arquivos Python para imports incorretos...")
    
    bad_patterns = [
        r'from\s+backend\.app\.backend',
        r'import\s+backend\.app\.backend',
        r'from\s+app\.backend',
        r'import\s+app\.backend'
    ]
    
    problematic_files = []
    
    # Procura por arquivos .py
    for py_file in base_dir.rglob("*.py"):
        # Ignora arquivos no backup
        if "backup_cleanup" in str(py_file):
            continue
        
        try:
            content = py_file.read_text(encoding='utf-8')
            
            for pattern in bad_patterns:
                if re.search(pattern, content):
                    problematic_files.append((py_file, pattern, content))
                    print(f"  ⚠ {py_file.relative_to(base_dir)}: {pattern}")
                    break
                    
        except Exception as e:
            print(f"  ✗ Erro ao ler {py_file}: {e}")
    
    return problematic_files

def fix_imports_in_file(file_path: Path, content: str):
    """Corrige imports incorretos em um arquivo"""
    
    print(f"🔧 Corrigindo: {file_path.name}")
    
    # Padrões de correção
    corrections = [
        (r'from\s+backend\.app\.backend\.app\.config', 'from app.config'),
        (r'from\s+backend\.app\.backend\.app\.models', 'from app.models'),
        (r'from\s+backend\.app\.backend\.app\.services', 'from app.services'),
        (r'from\s+backend\.app\.backend\.app\.api', 'from app.api'),
        (r'from\s+backend\.app\.backend\.app\.utils', 'from app.utils'),
        (r'from\s+backend\.app\.backend\.app\.db', 'from app.db'),
        (r'from\s+backend\.app\.backend\.app', 'from app'),
        (r'import\s+backend\.app\.backend\.app\.config', 'import app.config'),
        (r'import\s+backend\.app\.backend\.app\.models', 'import app.models'),
        (r'import\s+backend\.app\.backend\.app\.services', 'import app.services'),
        (r'import\s+backend\.app\.backend\.app\.api', 'import app.api'),
        (r'import\s+backend\.app\.backend\.app\.utils', 'import app.utils'),
        (r'import\s+backend\.app\.backend\.app\.db', 'import app.db'),
        (r'import\s+backend\.app\.backend\.app', 'import app'),
        (r'from\s+app\.backend\.app\.config', 'from app.config'),
        (r'from\s+app\.backend\.app\.models', 'from app.models'),
        (r'from\s+app\.backend\.app\.services', 'from app.services'),
        (r'from\s+app\.backend\.app\.api', 'from app.api'),
        (r'from\s+app\.backend\.app\.utils', 'from app.utils'),
        (r'from\s+app\.backend\.app\.db', 'from app.db'),
        (r'from\s+app\.backend\.app', 'from app'),
        (r'import\s+app\.backend\.app\.config', 'import app.config'),
        (r'import\s+app\.backend\.app\.models', 'import app.models'),
        (r'import\s+app\.backend\.app\.services', 'import app.services'),
        (r'import\s+app\.backend\.app\.api', 'import app.api'),
        (r'import\s+app\.backend\.app\.utils', 'import app.utils'),
        (r'import\s+app\.backend\.app\.db', 'import app.db'),
        (r'import\s+app\.backend\.app', 'import app')
    ]
    
    fixed_content = content
    changes_made = []
    
    for pattern, replacement in corrections:
        if re.search(pattern, fixed_content):
            old_line = re.search(pattern + r'[^\n]*', fixed_content)
            if old_line:
                old_text = old_line.group(0)
                new_content = re.sub(pattern, replacement, fixed_content)
                if new_content != fixed_content:
                    fixed_content = new_content
                    changes_made.append(f"  {old_text} → {replacement}")
    
    if changes_made:
        print(f"  Alterações feitas:")
        for change in changes_made:
            print(change)
        return fixed_content
    else:
        print(f"  Nenhuma alteração necessária")
        return None

def create_fixed_files(base_dir: Path, problematic_files):
    """Cria versões corrigidas dos arquivos problemáticos"""
    
    if not problematic_files:
        print("✅ Nenhum arquivo com imports incorretos encontrado!")
        return True
    
    print(f"\n🔧 Corrigindo {len(problematic_files)} arquivos...")
    
    fixed_count = 0
    
    for file_path, pattern, content in problematic_files:
        try:
            fixed_content = fix_imports_in_file(file_path, content)
            
            if fixed_content:
                # Faz backup do arquivo original
                backup_path = file_path.with_suffix('.py.backup')
                file_path.rename(backup_path)
                
                # Escreve versão corrigida
                file_path.write_text(fixed_content, encoding='utf-8')
                
                print(f"  ✓ {file_path.relative_to(base_dir)} corrigido")
                print(f"    Backup: {backup_path.name}")
                fixed_count += 1
            
        except Exception as e:
            print(f"  ✗ Erro ao corrigir {file_path}: {e}")
    
    print(f"\n📊 {fixed_count} arquivos corrigidos")
    return fixed_count > 0

def show_file_contents(base_dir: Path):
    """Mostra o conteúdo dos arquivos principais para debug"""
    
    print("\n📄 Conteúdo dos arquivos principais:")
    print("-" * 50)
    
    main_files = [
        "backend/app/main.py",
        "backend/app/config/settings.py", 
        "backend/app/config/database.py"
    ]
    
    for file_path in main_files:
        full_path = base_dir / file_path
        if full_path.exists():
            print(f"\n=== {file_path} ===")
            try:
                content = full_path.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                # Mostra apenas as primeiras 15 linhas para evitar spam
                for i, line in enumerate(lines[:15], 1):
                    if line.strip().startswith(('import ', 'from ')):
                        print(f"{i:2d}: {line}")
                    elif line.strip() and not line.startswith('#'):
                        print(f"{i:2d}: {line}")
                
                if len(lines) > 15:
                    print(f"... ({len(lines)} linhas total)")
                    
            except Exception as e:
                print(f"Erro ao ler arquivo: {e}")

def test_imports_after_fix(base_dir: Path):
    """Testa se os imports funcionam após a correção"""
    
    print("\n🧪 Testando imports após correção...")
    
    # Adiciona o diretório backend ao path
    backend_dir = base_dir / "backend"
    import sys
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    tests = [
        ("app.config.settings", "settings"),
        ("app.config.database", "db"),
        ("app.main", "app")
    ]
    
    all_passed = True
    
    for module_name, alias in tests:
        try:
            # Força reload do módulo se já foi importado
            if module_name in sys.modules:
                del sys.modules[module_name]
            
            exec(f"import {module_name} as {alias}")
            print(f"  ✓ {module_name}")
        except ImportError as e:
            print(f"  ✗ {module_name}: {e}")
            all_passed = False
        except Exception as e:
            print(f"  ⚠ {module_name}: {e}")
    
    return all_passed

def main():
    """Função principal"""
    print("PSWEB Python - Correção de Imports")
    print("=" * 50)
    
    base_dir = Path(__file__).parent
    
    try:
        # 1. Escanear por imports incorretos
        problematic_files = scan_for_bad_imports(base_dir)
        
        # 2. Mostrar conteúdo para debug (se necessário)
        if not problematic_files:
            show_file_contents(base_dir)
        
        # 3. Corrigir arquivos problemáticos
        if problematic_files:
            success = create_fixed_files(base_dir, problematic_files)
            
            if success:
                # 4. Testar imports após correção
                if test_imports_after_fix(base_dir):
                    print("\n🎉 Todos os imports corrigidos com sucesso!")
                    print("\nAgora execute: python run_server.py")
                else:
                    print("\n⚠ Alguns imports ainda têm problemas")
            else:
                print("\n❌ Falha ao corrigir alguns arquivos")
        else:
            # Se não encontrou imports problemáticos, tenta testar mesmo assim
            if test_imports_after_fix(base_dir):
                print("\n✅ Todos os imports estão funcionando!")
            else:
                print("\n❌ Há problemas nos imports que não foram detectados")
                print("Verifique manualmente os arquivos mostrados acima")
        
    except Exception as e:
        print(f"\n❌ Erro durante correção: {e}")
        return False
    
    return True

if __name__ == "__main__":
    main()