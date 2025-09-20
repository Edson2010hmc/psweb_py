#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Correção IMEDIATA dos erros de interface
Resolve: TemplateNotFound e Directory does not exist
Execute: python fix_interface_immediate.py
"""

from pathlib import Path
import shutil

def create_frontend_structure_immediate():
    """Cria estrutura frontend imediatamente"""
    print("📁 Criando estrutura frontend...")
    
    base_dir = Path(__file__).parent
    
    # Estrutura necessária
    directories = [
        "frontend",
        "frontend/templates",
        "frontend/static",
        "frontend/static/css",
        "frontend/static/js", 
        "frontend/static/assets"
    ]
    
    created = []
    for dir_path in directories:
        full_path = base_dir / dir_path
        if not full_path.exists():
            full_path.mkdir(parents=True, exist_ok=True)
            created.append(dir_path)
            print(f"  ✅ Criado: {dir_path}")
        else:
            print(f"  ✓ Existe: {dir_path}")
    
    return len(created)

def copy_interface_files_immediate():
    """Copia arquivos da migration IMEDIATAMENTE"""
    print("📄 Copiando arquivos da interface...")
    
    base_dir = Path(__file__).parent
    migration_dir = base_dir / "migration/scripts"
    
    if not migration_dir.exists():
        print(f"❌ Pasta migration/scripts não encontrada: {migration_dir}")
        return False
    
    # Mapeamento de arquivos
    file_mappings = [
        ("index.html", "frontend/templates/index.html"),
        ("styles.css", "frontend/static/css/styles.css"),
        ("app.js", "frontend/static/js/app.js")
    ]
    
    copied = []
    for source_name, dest_path in file_mappings:
        source_file = migration_dir / source_name
        dest_file = base_dir / dest_path
        
        if source_file.exists():
            try:
                # Copia diretamente (sobrescreve se existir)
                shutil.copy2(source_file, dest_file)
                copied.append(dest_path)
                size = dest_file.stat().st_size
                print(f"  ✅ {source_name} → {dest_path} ({size:,} bytes)")
            except Exception as e:
                print(f"  ❌ Erro ao copiar {source_name}: {e}")
        else:
            print(f"  ⚠️  Não encontrado: {source_name}")
    
    # Copia assets se existir
    assets_source = migration_dir / "assets"
    assets_dest = base_dir / "frontend/static/assets"
    
    if assets_source.exists():
        try:
            for item in assets_source.iterdir():
                if item.is_file():
                    dest_item = assets_dest / item.name
                    shutil.copy2(item, dest_item)
                    print(f"  ✅ Asset: {item.name}")
        except Exception as e:
            print(f"  ⚠️  Erro nos assets: {e}")
    else:
        # Cria logo placeholder
        logo_placeholder = assets_dest / "logo.png"
        logo_placeholder.touch()
        print(f"  📄 Logo placeholder criado")
    
    return len(copied) >= 2

def fix_html_paths_immediate():
    """Corrige caminhos no HTML IMEDIATAMENTE"""
    print("🔧 Corrigindo caminhos no HTML...")
    
    base_dir = Path(__file__).parent
    html_file = base_dir / "frontend/templates/index.html"
    
    if not html_file.exists():
        print("❌ index.html não encontrado após cópia")
        return False
    
    try:
        content = html_file.read_text(encoding='utf-8')
        
        # Correções essenciais
        fixes = [
            ('href="./styles.css"', 'href="/static/css/styles.css"'),
            ('<link rel="stylesheet" href="./styles.css"/>', '<link rel="stylesheet" href="/static/css/styles.css"/>'),
            ('src="./app.js"', 'src="/static/js/app.js"'),
            ('<script src="./app.js"></script>', '<script src="/static/js/app.js"></script>'),
            ('src="./assets/logo.png"', 'src="/static/assets/logo.png"'),
            ('src="./assets/', 'src="/static/assets/'),
            ('href="./assets/', 'href="/static/assets/')
        ]
        
        changes = 0
        for old, new in fixes:
            if old in content:
                content = content.replace(old, new)
                changes += 1
        
        html_file.write_text(content, encoding='utf-8')
        print(f"  ✅ {changes} caminhos corrigidos")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao corrigir HTML: {e}")
        return False

def create_minimal_files_if_missing():
    """Cria arquivos mínimos se estiverem faltando"""
    print("📝 Verificando arquivos essenciais...")
    
    base_dir = Path(__file__).parent
    
    # index.html mínimo se não existir
    html_file = base_dir / "frontend/templates/index.html"
    if not html_file.exists():
        print("⚠️  index.html não encontrado, criando mínimo...")
        
        minimal_html = '''<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Passagem de Serviço</title>
<link rel="stylesheet" href="/static/css/styles.css"/>
</head>
<body>
<header class="app-header">
  <div class="titles">
    <h2>PASSAGEM DE SERVIÇO</h2>
    <small>Fiscalização - Interface Migrada</small>
  </div>
</header>

<nav class="topnav">
  <button class="tablink active" data-tab="consultas">Início</button>
  <button class="tablink" data-tab="cadastros">Cadastros</button>
</nav>

<main>
  <section id="tab-consultas" class="tab active">
    <h3>Sistema funcionando!</h3>
    <p>Interface em migração para Python/FastAPI</p>
    <p>Backend com regras de negócio: ✅</p>
    <p>Frontend preservado: 🔄</p>
  </section>
  
  <section id="tab-cadastros" class="tab">
    <h3>Cadastros</h3>
    <p>Seção de cadastros</p>
  </section>
</main>

<script src="/static/js/app.js"></script>
</body>
</html>'''
        
        html_file.write_text(minimal_html, encoding='utf-8')
        print("  ✅ index.html mínimo criado")
    
    # styles.css mínimo se não existir
    css_file = base_dir / "frontend/static/css/styles.css"
    if not css_file.exists():
        print("⚠️  styles.css não encontrado, criando mínimo...")
        
        minimal_css = ''':root { 
  --brand:#0b7a66; 
  --line:#e0ece8; 
  --ink:#222; 
  --muted:#6b6b6b; 
  --bg:#f8fbfa; 
}

* { box-sizing: border-box; }

body { 
  margin:0; 
  font-family: Arial, Helvetica, sans-serif; 
  color:var(--ink); 
  background:#fff; 
}

.app-header { 
  display:flex; 
  align-items:center; 
  gap:12px; 
  padding:10px 14px; 
  border-bottom:3px solid var(--brand); 
  background:#fff; 
}

.titles h2 { 
  margin:0; 
  color:var(--brand); 
  font-size:26px; 
  letter-spacing:.3px; 
}

.titles small { 
  color:var(--muted); 
}

.topnav { 
  display:flex; 
  gap:6px; 
  padding:8px 10px; 
  border-bottom:1px solid var(--line); 
  background:#fff; 
}

.tablink { 
  border:1px solid var(--line); 
  background:#fff; 
  padding:8px 10px; 
  border-radius:6px; 
  cursor:pointer; 
}

.tablink.active { 
  background:#eff9f5; 
  border-color:#b9d8ce; 
}

main { 
  padding:12px; 
}

.tab { 
  display:none; 
}

.tab.active { 
  display:block; 
}'''
        
        css_file.write_text(minimal_css, encoding='utf-8')
        print("  ✅ styles.css mínimo criado")
    
    # app.js mínimo se não existir
    js_file = base_dir / "frontend/static/js/app.js"
    if not js_file.exists():
        print("⚠️  app.js não encontrado, criando mínimo...")
        
        minimal_js = '''// PSWEB Python - Interface migrada
console.log('PSWEB Python - Interface carregada');

// Sistema de abas
document.addEventListener('DOMContentLoaded', () => {
    console.log('Interface inicializada');
    
    // Ativa sistema de abas
    const tablinks = document.querySelectorAll('.tablink');
    const tabs = document.querySelectorAll('.tab');
    
    tablinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            
            // Remove active de todas
            tablinks.forEach(l => l.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            // Ativa a selecionada
            e.target.classList.add('active');
            const targetElement = document.getElementById(`tab-${targetTab}`);
            if (targetElement) {
                targetElement.classList.add('active');
            }
        });
    });
});'''
        
        js_file.write_text(minimal_js, encoding='utf-8')
        print("  ✅ app.js mínimo criado")
    
    return True

def test_interface_now():
    """Testa se interface funciona agora"""
    print("🧪 Testando interface...")
    
    base_dir = Path(__file__).parent
    
    # Verifica arquivos essenciais
    required_files = [
        "frontend/templates/index.html",
        "frontend/static/css/styles.css",
        "frontend/static/js/app.js"
    ]
    
    all_exist = True
    for file_path in required_files:
        full_path = base_dir / file_path
        if full_path.exists():
            size = full_path.stat().st_size
            print(f"  ✅ {file_path} ({size:,} bytes)")
        else:
            print(f"  ❌ {file_path} (FALTANDO)")
            all_exist = False
    
    if not all_exist:
        return False
    
    # Testa se main.py pode carregar
    try:
        backend_dir = base_dir / "backend"
        import sys
        sys.path.insert(0, str(backend_dir))
        
        # Remove módulos já carregados
        modules_to_remove = [m for m in sys.modules if m.startswith('app.')]
        for module_name in modules_to_remove:
            del sys.modules[module_name]
        
        from app.main import app
        print("  ✅ main.py carregado com sucesso")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Erro ao testar main.py: {e}")
        return False

def main():
    """Função principal - Correção imediata"""
    print("PSWEB Python - Correção IMEDIATA de Interface")
    print("Resolvendo: TemplateNotFound + Directory not exist")
    print("=" * 60)
    
    try:
        # 1. Cria estrutura
        created_dirs = create_frontend_structure_immediate()
        print(f"📁 {created_dirs} diretórios criados")
        
        # 2. Copia arquivos
        if copy_interface_files_immediate():
            print("✅ Arquivos da interface copiados")
        else:
            print("⚠️  Falha na cópia, criando arquivos mínimos...")
            create_minimal_files_if_missing()
        
        # 3. Corrige caminhos
        if fix_html_paths_immediate():
            print("✅ Caminhos do HTML corrigidos")
        
        # 4. Testa
        if test_interface_now():
            print("\n🎉 CORREÇÃO IMEDIATA CONCLUÍDA!")
            
            print("\n📋 Problemas resolvidos:")
            print("   ✅ Directory '../frontend/static' → Criado")
            print("   ✅ TemplateNotFound: index.html → Resolvido")
            print("   ✅ Arquivos estáticos → Disponíveis")
            
            print("\n🚀 REINICIE O SERVIDOR AGORA:")
            print("   1. Ctrl+C para parar servidor atual")
            print("   2. python run_server.py")
            print("   3. Acesse: http://127.0.0.1:8000")
            
            print("\n✨ Interface funcionará corretamente!")
            
            return True
        else:
            print("\n⚠️  Correção aplicada mas ainda há problemas")
            print("Execute novamente: python run_server.py")
            return True
        
    except Exception as e:
        print(f"\n❌ Erro durante correção: {e}")
        return False

if __name__ == "__main__":
    main()