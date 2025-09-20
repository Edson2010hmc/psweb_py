#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para listar a estrutura atual do projeto PSWEB Python
Execute: python list_structure.py
"""

import os
from pathlib import Path

def list_directory_tree(start_path: Path, max_depth: int = 6):
    """Lista a árvore de diretórios atual"""
    
    def print_tree(path: Path, prefix: str = "", current_depth: int = 0):
        """Imprime árvore de arquivos recursivamente"""
        
        if current_depth >= max_depth:
            print(f"{prefix}[...] (máxima profundidade atingida)")
            return
            
        try:
            # Lista todos os itens no diretório
            items = list(path.iterdir())
            
            # Separa diretórios e arquivos, ordena cada grupo
            dirs = sorted([item for item in items if item.is_dir()], key=lambda x: x.name.lower())
            files = sorted([item for item in items if item.is_file()], key=lambda x: x.name.lower())
            
            # Combina: diretórios primeiro, depois arquivos
            all_items = dirs + files
            
            for i, item in enumerate(all_items):
                # Ignora alguns diretórios/arquivos especiais para clareza
                if item.name.startswith('.') and item.name not in ['.env', '.env.example', '.gitignore']:
                    continue
                if item.name in ['__pycache__', '.git']:
                    continue
                
                is_last = i == len(all_items) - 1
                current_prefix = "└── " if is_last else "├── "
                
                if item.is_dir():
                    print(f"{prefix}{current_prefix}{item.name}/")
                    
                    # Preparar prefixo para próximo nível
                    extension = "    " if is_last else "│   "
                    print_tree(item, prefix + extension, current_depth + 1)
                    
                else:
                    # Mostrar informações do arquivo
                    try:
                        size = item.stat().st_size
                        if size == 0:
                            size_str = " (vazio)"
                        elif size < 1024:
                            size_str = f" ({size} bytes)"
                        elif size < 1024 * 1024:
                            size_str = f" ({size//1024}KB)"
                        else:
                            size_str = f" ({size//(1024*1024)}MB)"
                    except:
                        size_str = " (erro ao ler tamanho)"
                    
                    print(f"{prefix}{current_prefix}{item.name}{size_str}")
                    
        except PermissionError:
            print(f"{prefix}[ERRO: Acesso negado]")
        except Exception as e:
            print(f"{prefix}[ERRO: {e}]")
    
    print(f"{start_path.name}/")
    print_tree(start_path)

def show_summary(start_path: Path):
    """Mostra resumo da estrutura"""
    
    total_dirs = 0
    total_files = 0
    total_size = 0
    empty_files = 0
    
    def count_items(path: Path):
        nonlocal total_dirs, total_files, total_size, empty_files
        
        try:
            for item in path.iterdir():
                if item.name.startswith('.') and item.name not in ['.env', '.env.example', '.gitignore']:
                    continue
                if item.name in ['__pycache__', '.git']:
                    continue
                    
                if item.is_dir():
                    total_dirs += 1
                    count_items(item)  # recursão
                elif item.is_file():
                    total_files += 1
                    try:
                        size = item.stat().st_size
                        total_size += size
                        if size == 0:
                            empty_files += 1
                    except:
                        pass
        except:
            pass
    
    count_items(start_path)
    
    print("\n" + "=" * 60)
    print("RESUMO:")
    print(f"📁 Diretórios: {total_dirs}")
    print(f"📄 Arquivos: {total_files}")
    print(f"📏 Tamanho total: {total_size//1024}KB" if total_size >= 1024 else f"📏 Tamanho total: {total_size} bytes")
    print(f"📋 Arquivos vazios: {empty_files}")

def show_python_files(start_path: Path):
    """Lista especificamente arquivos Python"""
    
    python_files = []
    
    def find_python_files(path: Path):
        try:
            for item in path.iterdir():
                if item.name.startswith('.') or item.name == '__pycache__':
                    continue
                    
                if item.is_dir():
                    find_python_files(item)
                elif item.is_file() and item.suffix == '.py':
                    rel_path = item.relative_to(start_path)
                    size = item.stat().st_size
                    python_files.append((str(rel_path), size))
        except:
            pass
    
    find_python_files(start_path)
    
    if python_files:
        print("\n" + "=" * 60)
        print("ARQUIVOS PYTHON ENCONTRADOS:")
        python_files.sort()
        for file_path, size in python_files:
            size_str = f"({size} bytes)" if size < 1024 else f"({size//1024}KB)"
            status = "vazio" if size == 0 else "ok"
            print(f"  {file_path} {size_str} [{status}]")
    else:
        print("\n⚠️  Nenhum arquivo Python (.py) encontrado!")

def show_config_files(start_path: Path):
    """Lista arquivos de configuração"""
    
    config_extensions = ['.env', '.txt', '.md', '.json', '.yaml', '.yml', '.ini', '.cfg']
    config_files = []
    
    def find_config_files(path: Path):
        try:
            for item in path.iterdir():
                if item.name.startswith('.') and item.name not in ['.env', '.env.example', '.gitignore']:
                    continue
                if item.name == '__pycache__':
                    continue
                    
                if item.is_dir():
                    find_config_files(item)
                elif item.is_file():
                    if (item.suffix.lower() in config_extensions or 
                        item.name in ['requirements.txt', 'README.md', '.gitignore']):
                        rel_path = item.relative_to(start_path)
                        size = item.stat().st_size
                        config_files.append((str(rel_path), size))
        except:
            pass
    
    find_config_files(start_path)
    
    if config_files:
        print("\n" + "=" * 60)
        print("ARQUIVOS DE CONFIGURAÇÃO:")
        config_files.sort()
        for file_path, size in config_files:
            size_str = f"({size} bytes)" if size < 1024 else f"({size//1024}KB)"
            status = "vazio" if size == 0 else "ok"
            print(f"  {file_path} {size_str} [{status}]")

def main():
    """Função principal"""
    print("PSWEB Python - Listagem da Estrutura Atual")
    print("=" * 60)
    
    # Define diretório base
    base_dir = Path(__file__).parent
    print(f"Diretório base: {base_dir}")
    print(f"Caminho absoluto: {base_dir.absolute()}")
    
    if not base_dir.exists():
        print("❌ Diretório não encontrado!")
        return
    
    print("\n" + "=" * 60)
    print("ESTRUTURA COMPLETA:")
    print("-" * 30)
    
    # Lista a árvore completa
    list_directory_tree(base_dir)
    
    # Mostra resumo
    show_summary(base_dir)
    
    # Lista arquivos Python especificamente
    show_python_files(base_dir)
    
    # Lista arquivos de configuração
    show_config_files(base_dir)
    
    print("\n" + "=" * 60)
    print("✅ Listagem concluída!")
    print("\n💡 Copie toda esta saída e envie para análise.")

if __name__ == "__main__":
    main()