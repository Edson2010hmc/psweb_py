#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWEB Python - Aplicação Principal - CORRIGIDO
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

# Static files - CORRIGIDO: Agora aponta para o diretório correto
try:
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
        logger.info(f"Arquivos estáticos montados: {STATIC_DIR}")
    else:
        logger.error(f"Diretório estático não encontrado: {STATIC_DIR}")
except Exception as e:
    logger.error(f"Erro ao montar arquivos estáticos: {e}")

# === INCLUIR TODAS AS APIs COM REGRAS DE NEGÓCIO REFATORADAS ===
app.include_router(fiscais_api.router, tags=["Fiscais"])
app.include_router(embarcacoes_router, tags=["Embarcações"]) 
app.include_router(passagens_api.router, tags=["Passagens"])

# === FRONTEND - APENAS INTERFACE ===
@app.get("/", response_class=HTMLResponse, tags=["Frontend"])
async def root(request: Request):
    """Serve a interface web"""
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        logger.error(f"Erro ao servir index.html: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar interface")

# === API DE SISTEMA ===
@app.get("/api", tags=["Sistema"])
async def api_root():
    """Endpoint raiz da API"""
    return {
        "message": "PSWEB Python API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }

# === ROTA TEMPORÁRIA PARA FOTO DO USUÁRIO ===
@app.get("/api/me/photo", tags=["Sistema"])
async def get_user_photo():
    """
    Rota temporária para foto do usuário
    TODO: Implementar lógica de foto real
    """
    # Por enquanto, retorna 404 para não quebrar o frontend
    raise HTTPException(status_code=404, detail="Foto não disponível")

@app.get("/health", tags=["Sistema"])
async def health_check():
    """Health check com teste de banco"""
    try:
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
    
    return {
        "status": "ok",
        "database": db_status,
        "version": "2.0.0",
        "static_dir": str(STATIC_DIR),
        "templates_dir": str(TEMPLATES_DIR)
    }

@app.on_event("startup")
async def startup_event():
    """Inicialização da aplicação"""
    logger.info("Iniciando PSWEB Python API...")
    
    # Verificar estrutura de arquivos
    logger.info(f"Base directory: {BASE_DIR}")
    logger.info(f"Frontend directory: {FRONTEND_DIR}")
    logger.info(f"Templates directory: {TEMPLATES_DIR} (exists: {TEMPLATES_DIR.exists()})")
    logger.info(f"Static directory: {STATIC_DIR} (exists: {STATIC_DIR.exists()})")
    
    if STATIC_DIR.exists():
        # Listar arquivos estáticos encontrados
        for root, dirs, files in os.walk(STATIC_DIR):
            for file in files:
                rel_path = Path(root).relative_to(STATIC_DIR) / file
                logger.info(f"  Static file: {rel_path}")
    
    try:
        success = await init_database()
        if success:
            logger.info("Banco de dados conectado com sucesso")
        else:
            logger.error("Falha ao conectar com banco de dados")
    except Exception as e:
        logger.error(f"Erro na inicialização do banco: {e}")
    
    logger.info("PSWEB Python API iniciada com sucesso!")

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
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )