#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARQUIVO: backend/app/main.py
PSWEB Python - Aplicação Principal - COM DEBUG CONDICIONAL
PASSO 2: ADICIONADA inicialização da variável global USERNAME
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
import logging
import os
from pathlib import Path

from app.config.settings import settings
from app.config.database import init_database

# Importar TODAS as APIs com regras de negócio REFATORADAS
from app.api.v1 import fiscais_api, passagens_api
from app.api.v1.embarcacoes_api import router as embarcacoes_router
from app.api.v1.administradores_api import router as administradores_router
from app.api.v1.auth_api import router as auth_router  # NOVA ROTA DE AUTENTICAÇÃO

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PSWEB - Passagem de Serviço",
    description="Sistema de Passagem de Serviço - Fiscalização (Python)",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else ["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração de caminhos
BASE_DIR = Path(__file__).parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"

# Templates (Jinja2)
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Static files
try:
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
        logger.info(f"Arquivos estáticos montados: {STATIC_DIR}")
    else:
        logger.error(f"Diretório estático não encontrado: {STATIC_DIR}")
except Exception as e:
    logger.error(f"Erro ao montar arquivos estáticos: {e}")

# === INCLUIR TODAS AS APIs ===
app.include_router(auth_router, tags=["Autenticação"])
app.include_router(fiscais_api.router, tags=["Fiscais"])
app.include_router(embarcacoes_router, tags=["Embarcações"]) 
app.include_router(passagens_api.router, tags=["Passagens"])
app.include_router(administradores_router, tags=["Administradores"])

# === ROTA DE DEBUG CONDICIONAL ===
if settings.DEBUG:
    @app.get("/debug-system")
    async def debug_system():
        """[DEBUG] Informações do sistema - só aparece em debug mode"""
        return {
            "debug_mode": True,
            "message": "Sistema em modo DEBUG",
            "config": {
                "DEBUG": settings.DEBUG,
                "DEBUG_AUTH": settings.DEBUG_AUTH,
                "DEBUG_ROUTES": settings.DEBUG_ROUTES,
                "AUTH_FIELD": settings.AUTH_FIELD
            },
            "available_debug_routes": [
                "/api/auth/debug-full",
                "/api/auth/debug-config", 
                "/api/auth/test-windows",
                "/debug-system"
            ] if settings.DEBUG_AUTH else ["/debug-system"]
        }

# === FRONTEND ===
@app.get("/", response_class=HTMLResponse, tags=["Frontend"])
async def serve_frontend(request: Request):
    """Serve a aplicação frontend"""
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        logger.error(f"Erro ao servir frontend: {e}")
        return HTMLResponse(
            content=f"<h1>Erro no Frontend</h1><p>{str(e)}</p>",
            status_code=500
        )

# === HEALTH CHECK ===
@app.get("/health", tags=["Health"])
async def health_check():
    """Endpoint para verificação de saúde da API"""
    try:
        # Testa conexão com banco
        from app.config.database import db
        connection = db.get_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT 1 FROM RDB$DATABASE")
        result = cursor.fetchone()
        cursor.close()
        connection.close()
        
        db_status = "ok" if result else "error"
    except Exception as e:
        logger.error(f"Erro no health check do banco: {e}")
        db_status = "error"
    
    response = {
        "status": "ok",
        "database": db_status,
        "version": "2.0.0"
    }
    
    if settings.DEBUG:
        response["debug_mode"] = True
        response["debug_config"] = {
            "DEBUG": settings.DEBUG,
            "DEBUG_AUTH": settings.DEBUG_AUTH,
            "DEBUG_ROUTES": settings.DEBUG_ROUTES
        }
    
    return response

@app.on_event("startup")
async def startup_event():
    """
    Inicialização da aplicação
    PASSO 2: ADICIONADA inicialização da variável global USERNAME
    """
    logger.info("Iniciando PSWEB Python API...")
    logger.info(f"Modo de autenticação: windows_server")
    logger.info(f"Campo de autenticação: {settings.AUTH_FIELD}")
    
    # === LOG CONDICIONAL DE ROTAS ===
    if settings.DEBUG_ROUTES:
        logger.info("=== ROTAS REGISTRADAS (DEBUG) ===")
        for route in app.routes:
            if hasattr(route, 'methods') and hasattr(route, 'path'):
                logger.info(f"  {list(route.methods)} {route.path}")
        logger.info("=== FIM DAS ROTAS ===")
    
    # === LOG CONDICIONAL DE FLAGS DE DEBUG ===
    if settings.DEBUG:
        logger.info(f"🔧 DEBUG MODE: Habilitado")
        logger.info(f"🔧 DEBUG_AUTH: {settings.DEBUG_AUTH}")
        logger.info(f"🔧 DEBUG_ROUTES: {settings.DEBUG_ROUTES}")
        if settings.DEBUG_AUTH:
            logger.info("🔧 Rotas de debug auth disponíveis em /api/auth/debug-*")
    else:
        logger.info("🔒 Production mode - debug desabilitado")
    
    try:
        # 1. Inicializa banco de dados
        logger.info("📊 Inicializando banco de dados...")
        success = await init_database()
        if success:
            logger.info("✅ Banco de dados conectado com sucesso")
        else:
            logger.error("❌ Falha ao conectar com banco de dados")
            
        # *** PASSO 2: Inicializa variável global USERNAME Windows ***
        logger.info("🔐 Inicializando variável global USERNAME...")
        from app.services.auth_service import initialize_global_username, get_global_username
        
        username_success = initialize_global_username()
        if username_success:
            username = get_global_username()
            logger.info("✅ Variável global USERNAME inicializada com sucesso")
            logger.info(f"💻 USERNAME Windows armazenado: {username}")
        else:
            logger.error("❌ Falha na inicialização da variável global USERNAME")
            logger.error("⚠️  Sistema funcionará sem USERNAME global")
            
    except Exception as e:
        logger.error(f"Erro na inicialização: {e}")
    
    logger.info("✅ PSWEB Python API iniciada com sucesso!")

@app.on_event("shutdown")
async def shutdown_event():
    """Finalização da aplicação"""
    logger.info("Finalizando PSWEB Python API...")

if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Iniciando servidor em {settings.HOST}:{settings.PORT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Interface web: http://{settings.HOST}:{settings.PORT}")
    logger.info(f"API Docs: http://{settings.HOST}:{settings.PORT}/docs")
    logger.info(f"Autenticação: Windows Server ({settings.AUTH_FIELD})")
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )