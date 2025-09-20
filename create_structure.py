#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import os
import sys
from pathlib import Path

def create_directory_structure():
    """Cria a estrutura completa de diretórios do projeto PSWEB Python"""
    
    # Diretório base
    base_dir = Path(r"c:\users\public\psweb_py")
    
    # Estrutura de diretórios
    directories = [
        # Raiz do projeto
        "",
        
        # Backend Python
        "backend",
        "backend/app",
        "backend/app/config",
        "backend/app/models",
        "backend/app/models/porto",
        "backend/app/models/rotina", 
        "backend/app/models/os",
        "backend/app/models/gerais",
        "backend/app/services",
        "backend/app/services/porto",
        "backend/app/services/rotina",
        "backend/app/services/os", 
        "backend/app/services/gerais",
        "backend/app/api",
        "backend/app/api/v1",
        "backend/app/utils",
        "backend/app/db",
        
        # Frontend minimalista
        "frontend",
        "frontend/static",
        "frontend/static/css",
        "frontend/static/js",
        "frontend/static/assets",
        "frontend/templates",
        
        # Storage para arquivos das PS
        "storage",
        "storage/PS",
        "storage/temp",
        "storage/exports",
        
        # Documentação
        "docs",
        "docs/api",
        "docs/database",
        
        # Scripts de migração
        "migration",
        "migration/scripts",
        "migration/backup",
        
        # Testes
        "tests",
        "tests/unit",
        "tests/integration",
        "tests/fixtures",
        
        # Configurações
        "config",
        
        # Logs
        "logs"
    ]
    
    print(f"Criando estrutura de pastas em: {base_dir}")
    print("=" * 60)
    
    # Criar diretórios
    created_count = 0
    for directory in directories:
        dir_path = base_dir / directory if directory else base_dir
        
        try:
            dir_path.mkdir(parents=True, exist_ok=True)
            status = "✓ Criado" if not dir_path.exists() else "✓ Existe"
            print(f"{status}: {dir_path}")
            created_count += 1
        except Exception as e:
            print(f"✗ Erro ao criar {dir_path}: {e}")
    
    return base_dir, created_count

def create_initial_files():
    """Cria arquivos iniciais importantes"""
    
    base_dir = Path(r"c:\users\public\psweb_py")
    
    files_to_create = {
        # Modelos baseados no template completo
        "backend/app/models/rotina.py": """#!/usr/bin/env python3
# -*- coding: utf-8 -*-
\"\"\"
Modelos para Seção 4 - ROTINA (IAPO, SMS, Smart RDO)
Baseado no template completo da aplicação
\"\"\"

from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

class StatusOSEnum(str, Enum):
    SIM = "SIM"
    NAO = "NAO"

class SimNaoEnum(str, Enum):
    SIM = "SIM"
    NAO = "NAO"

# 4.1 IAPO
class RotinaIAPO(BaseModel):
    passagem_id: int
    quinzena_encerrada_data1: Optional[date] = None  # 1º domingo
    quinzena_encerrada_oss1: StatusOSEnum = StatusOSEnum.NAO
    quinzena_encerrada_data2: Optional[date] = None  # 2º domingo  
    quinzena_encerrada_oss2: StatusOSEnum = StatusOSEnum.NAO
    para_quinzena_data3: Optional[date] = None       # 3º domingo
    para_quinzena_oss3: StatusOSEnum = StatusOSEnum.NAO
    observacoes: Optional[str] = None

# 4.2.1 SMS - LV Mangueiras
class SMSLVMangueiras(BaseModel):
    passagem_id: int
    data_ultima_lv: Optional[date] = None
    data_proxima_lv: Optional[date] = None  # calculada = última + 2 meses
    observacoes: Optional[str] = None

# 4.2.2 SMS - LV Segurança  
class SMSLVSeguranca(BaseModel):
    passagem_id: int
    farois_embarcacao_imagem: Optional[str] = None  # path para imagem
    farois_fiscal_imagem: Optional[str] = None      # path para imagem
    observacoes: Optional[str] = None

# 4.2.3 SMS - Auditoria Hora Segura
class SMSAuditoriaHoraSegura(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    data: date
    anexo: Optional[str] = None
    gerou_pendencia_broa: SimNaoEnum = SimNaoEnum.NAO

# 4.2.4 SMS - RAC QSMS
class SMSRACQSMS(BaseModel):
    passagem_id: int
    data: Optional[date] = None
    anexo: Optional[str] = None
    observacoes: Optional[str] = None

# 4.2.5 SMS - AIS
class SMSAIS(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nao_ocorreu_quinzena: bool = False
    data: Optional[date] = None
    descricao: Optional[str] = None
    prazo_envio: Optional[date] = None
    enviado: SimNaoEnum = SimNaoEnum.NAO
    link_form: Optional[str] = None
    anexo: Optional[str] = None
    observacoes: Optional[str] = None

# 4.2.6 SMS - Pendências BROA
class SMSPendenciasBROA(BaseModel):
    passagem_id: int
    pendencias_vencendo: SimNaoEnum = SimNaoEnum.NAO
    anexo_afretamento: Optional[str] = None
    anexo_servicos_tecnicos: Optional[str] = None

# 4.2.8 SMS - Alertas
class SMSAlertas(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nao_ocorreu_quinzena: bool = False
    data: Optional[date] = None
    descricao: Optional[str] = None
    data_divulgacao: Optional[date] = None
    proxima_divulgacao: Optional[date] = None
    observacoes: Optional[str] = None

# 4.3 Smart RDO
class SmartRDO(BaseModel):
    passagem_id: int
    comandante: Optional[str] = None
    offshore_manager: Optional[str] = None
    cc: Optional[str] = None  # texto multilinha
    nenhuma_nova_orientacao: bool = False

class SmartRDOOrientacao(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    data: date
    descricao: str
    anexo: Optional[str] = None
""",

        "backend/app/models/os.py": """#!/usr/bin/env python3
# -*- coding: utf-8 -*-
\"\"\"
Modelos para Seção 6 - ORDENS DE SERVIÇO
Baseado no template completo da aplicação
\"\"\"

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ProtocoloAproximacaoEnum(str, Enum):
    NAO_APLICAVEL = "NÃO APLICÁVEL"
    REVALIDAR = "REVALIDAR"
    EMITIR = "EMITIR"

# 6.1 OS Previstas com Orientações Específicas
class OSPrevista(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nenhuma_os_especifica: bool = False
    ordem_servico: Optional[str] = None
    descricao: Optional[str] = None
    protocolo_aproximacao: Optional[ProtocoloAproximacaoEnum] = None
    observacoes: Optional[str] = None

# 6.2 OS Interrompidas  
class OSInterrompida(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nenhuma_os_interrompida: bool = False
    ordem_servico: Optional[str] = None
    descricao: Optional[str] = None
    protocolo_aproximacao: Optional[ProtocoloAproximacaoEnum] = None
    observacoes: Optional[str] = None
    relatorio: Optional[str] = None

# 6.3 Anotações e Observações Gerais
class OSAnotacoesGerais(BaseModel):
    passagem_id: int
    anotacoes_observacoes: Optional[str] = None  # campo texto multilinha
""",

        "backend/app/models/gerais.py": """#!/usr/bin/env python3
# -*- coding: utf-8 -*-
\"\"\"
Modelos para Seção 7 - INFORMAÇÕES GERAIS
Baseado no template completo da aplicação  
\"\"\"

from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from enum import Enum

class TipoDispositivoEnum(str, Enum):
    NOTEBOOK = "Notebook"
    DESKTOP = "Desktop"

class ResponsavelEnum(str, Enum):
    MIS = "MIS"
    CRD = "CRD" 
    EQSE = "EQSE"
    OUTROS = "OUTROS"

class SimNaoEnum(str, Enum):
    SIM = "SIM"
    NAO = "NAO"

# 7.1 Gerência de Contrato e Suporte Técnico
class GerenciaContrato(BaseModel):
    passagem_id: int
    # Gerente de Contrato
    gerente_nome: Optional[str] = None
    gerente_chave: Optional[str] = None
    gerente_telefone: Optional[str] = None
    # Fiscal Administrativo
    fiscal_adm_nome: Optional[str] = None
    fiscal_adm_chave: Optional[str] = None
    fiscal_adm_telefone: Optional[str] = None
    # ATO
    ato_nome: Optional[str] = None
    ato_chave: Optional[str] = None
    ato_empresa: Optional[str] = None
    ato_telefone: Optional[str] = None
    # STO Petrobras
    sto_nome: Optional[str] = None
    sto_chave: Optional[str] = None
    sto_telefone: Optional[str] = None
    # Outras Informações
    outras_informacoes: Optional[str] = None

# 7.2 Dados das Contratadas
class DadosContratadas(BaseModel):
    passagem_id: int
    # Contratada Serviços Técnicos
    contratada_servicos: Optional[str] = None
    preposto_servicos_nome: Optional[str] = None
    preposto_servicos_telefone: Optional[str] = None
    preposto_servicos_email: Optional[str] = None
    sto_servicos_nome: Optional[str] = None
    sto_servicos_telefone: Optional[str] = None
    sto_servicos_email: Optional[str] = None
    # Contratada Afretamento
    contratada_afretamento: Optional[str] = None
    preposto_afret_nome: Optional[str] = None
    preposto_afret_telefone: Optional[str] = None
    preposto_afret_email: Optional[str] = None
    # Outras Informações
    outras_informacoes: Optional[str] = None

# 7.3 Materiais e Equipamentos a Bordo
class MateriaisEquipamentos(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nao_ha_materiais: bool = False
    ordem_servico: Optional[str] = None
    descricao: Optional[str] = None
    responsavel: Optional[ResponsavelEnum] = None
    numero_serie: Optional[str] = None
    data_embarque: Optional[date] = None
    observacoes: Optional[str] = None

# 7.4.1 Telefones e Ramais
class TelefonesRamais(BaseModel):
    passagem_id: int
    # Sala Fiscalização
    fiscal_ramal_petrobras: Optional[str] = None
    fiscal_rota: Optional[str] = None
    fiscal_ramal_interno: Optional[str] = None
    fiscal_telefone_externo: Optional[str] = None
    # Sala de Operações
    operacoes_ramal_petrobras: Optional[str] = None
    operacoes_rota: Optional[str] = None
    operacoes_ramal_interno: Optional[str] = None
    operacoes_telefone_externo: Optional[str] = None
    operacoes_celular: Optional[str] = None
    # Camarote Fiscal
    camarote_ramal_petrobras: Optional[str] = None
    camarote_rota: Optional[str] = None
    camarote_ramal_interno: Optional[str] = None
    camarote_telefone_externo: Optional[str] = None
    # Passadiço
    passadico_ramal_petrobras: Optional[str] = None
    passadico_rota: Optional[str] = None
    passadico_ramal_interno: Optional[str] = None
    passadico_telefone_externo: Optional[str] = None
    passadico_celular: Optional[str] = None
    passadico_inmarsat: Optional[str] = None
    # Outros
    enfermaria: Optional[str] = None
    rov: Optional[str] = None
    praca_maquinas: Optional[str] = None
    cozinha: Optional[str] = None
    comandante_ramal: Optional[str] = None
    comandante_telefone: Optional[str] = None

# 7.4.3 Computadores Homologados
class ComputadoresHomologados(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    tipo: TipoDispositivoEnum
    numero_tic: Optional[str] = None
    data_ultimo_login: Optional[date] = None
    realizar_login_ate: Optional[date] = None
    observacoes: Optional[str] = None

# 7.4.4 Senhas de Acesso
class SenhasAcesso(BaseModel):
    passagem_id: int
    # WIFI
    wifi_ssid: Optional[str] = None
    wifi_senha: Optional[str] = None
    # PC Desktop
    pc_usuario: Optional[str] = None
    pc_senha: Optional[str] = None
    # CFTV
    cftv_funcional: SimNaoEnum = SimNaoEnum.NAO
    cftv_login: Optional[str] = None
    cftv_senha: Optional[str] = None
    # Observações
    observacoes: Optional[str] = None

# 7.4.5 Acomodações
class Acomodacoes(BaseModel):
    passagem_id: int
    descricao: Optional[str] = None
""",

        # Arquivos de configuração Python
        "backend/requirements.txt": """# PSWEB Python - Dependências
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
fdb==2.0.2
reportlab==4.0.7
openpyxl==3.1.2
python-dotenv==1.0.0
jinja2==3.1.2
aiofiles==23.2.1
""",

        "backend/.env.example": """# Configuração do Banco Firebird
DB_HOST=127.0.0.1
DB_PORT=3050
DB_NAME=C:\\Users\\Public\\Firebird-4.0.5.3140-0-x64\\psweb_data\\PSWEB.FDB
DB_USER=SYSDBA
DB_PASS=masterkey

# Configurações da aplicação
SECRET_KEY=change-me-in-production
USE_WINDOWS_AUTH=true
STORAGE_DIR=../storage

# PDF e relatórios
PDF_LOGO=../frontend/static/assets/logo.png

# Servidor
HOST=127.0.0.1
PORT=8000
DEBUG=true
""",

        "backend/app/main.py": """#!/usr/bin/env python3
# -*- coding: utf-8 -*-
\"\"\"
PSWEB Python - Aplicação Principal
\"\"\"

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.api import auth, passagens, porto, admin
from app.config.database import init_database

app = FastAPI(
    title="PSWEB - Passagem de Serviço",
    description="Sistema de Passagem de Serviço - Fiscalização",
    version="2.0.0"
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(passagens.router)
app.include_router(porto.router)
app.include_router(admin.router)

# Static files
app.mount("/static", StaticFiles(directory="../frontend/static"), name="static")

@app.on_event("startup")
async def startup_event():
    \"\"\"Inicialização da aplicação\"\"\"
    await init_database()
    
@app.get("/")
async def root():
    return {"message": "PSWEB Python API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
""",

        "backend/app/config/__init__.py": "",
        "backend/app/models/__init__.py": "",
        "backend/app/services/__init__.py": "",
        "backend/app/api/__init__.py": "",
        "backend/app/utils/__init__.py": "",
        "backend/app/db/__init__.py": "",

        # Arquivo de configurações
        "backend/app/config/settings.py": """from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Banco de dados
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3050
    DB_NAME: str
    DB_USER: str = "SYSDBA"
    DB_PASS: str = "masterkey"
    
    # Aplicação
    SECRET_KEY: str = "change-me"
    USE_WINDOWS_AUTH: bool = True
    STORAGE_DIR: str = "../storage"
    
    # Servidor
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True
    
    # PDF
    PDF_LOGO: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
""",

        # README principal
        "README.md": """# PSWEB Python

Sistema de Passagem de Serviço migrado para Python com FastAPI.

## Estrutura do Projeto

```
psweb_py/
├── backend/           # API Python com FastAPI
├── frontend/          # Interface web minimalista
├── storage/           # Arquivos das PS
├── migration/         # Scripts de migração
├── tests/            # Testes automatizados
└── docs/             # Documentação
```

## Instalação

1. Instalar dependências:
```bash
cd backend
pip install -r requirements.txt
```

2. Configurar ambiente:
```bash
cp .env.example .env
# Editar .env com suas configurações
```

3. Executar aplicação:
```bash
python app/main.py
```

## Desenvolvimento

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Frontend: http://localhost:8000/static/

## Migração

Scripts de migração na pasta `migration/`
""",

        # Arquivos do frontend
        "frontend/static/css/style.css": """/* PSWEB Python - Estilos básicos */
:root {
    --brand: #0b7a66;
    --line: #e0ece8;
    --ink: #222;
    --muted: #6b6b6b;
    --bg: #f8fbfa;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    font-family: Arial, sans-serif;
    color: var(--ink);
    background: #fff;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.btn {
    padding: 8px 16px;
    background: var(--brand);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.btn:hover {
    opacity: 0.9;
}
""",

        "frontend/static/js/app.js": """// PSWEB Python - JavaScript principal
console.log('PSWEB Python carregado');

// API base
const API_BASE = '/api';

// Utilitários
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado');
});
""",

        "frontend/templates/index.html": """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PSWEB Python</title>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div class="container">
        <h1>PSWEB Python</h1>
        <p>Sistema de Passagem de Serviço</p>
        <p>Status: <span id="status">Carregando...</span></p>
    </div>
    <script src="/static/js/app.js"></script>
</body>
</html>
""",

        # Script de migração exemplo
        "migration/scripts/migrate_from_node.py": """#!/usr/bin/env python3
# -*- coding: utf-8 -*-
\"\"\"
Script de migração do Node.js para Python
\"\"\"

def main():
    print("Script de migração - PSWEB")
    print("Migração do Node.js para Python")
    
if __name__ == "__main__":
    main()
""",

        # Gitignore
        ".gitignore": """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg
PIPFILE.lock

# Environment
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
logs/
*.log

# Storage (arquivos das PS)
storage/PS/*/
storage/temp/
storage/exports/

# Database backups
migration/backup/

# OS
.DS_Store
Thumbs.db
""",
    }
    
    print("\nCriando arquivos iniciais:")
    print("=" * 60)
    
    created_files = 0
    for file_path, content in files_to_create.items():
        full_path = base_dir / file_path
        
        try:
            # Criar diretório pai se não existir
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Criar arquivo se não existir
            if not full_path.exists():
                full_path.write_text(content, encoding='utf-8')
                print(f"✓ Criado: {file_path}")
                created_files += 1
            else:
                print(f"⚠ Já existe: {file_path}")
        except Exception as e:
            print(f"✗ Erro ao criar {file_path}: {e}")
    
    return created_files

def main():
    """Função principal"""
    print("PSWEB Python - Criador de Estrutura")
    print("=" * 60)
    
    try:
        # Verificar se é Windows
        if os.name != 'nt':
            print("⚠ Aviso: Este script foi projetado para Windows")
            response = input("Continuar mesmo assim? (s/N): ")
            if response.lower() not in ['s', 'sim', 'y', 'yes']:
                print("Operação cancelada")
                return
        
        # Criar estrutura de diretórios
        base_dir, dir_count = create_directory_structure()
        
        # Criar arquivos iniciais
        file_count = create_initial_files()
        
        print("\n" + "=" * 60)
        print("ESTRUTURA CRIADA COM SUCESSO!")
        print(f"Diretório base: {base_dir}")
        print(f"Diretórios criados: {dir_count}")
        print(f"Arquivos criados: {file_count}")
        print("\nPróximos passos:")
        print("1. cd c:\\users\\public\\psweb_py\\backend")
        print("2. pip install -r requirements.txt")
        print("3. cp .env.example .env")
        print("4. Editar .env com suas configurações")
        print("5. python app/main.py")
        
    except Exception as e:
        print(f"✗ Erro geral: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()