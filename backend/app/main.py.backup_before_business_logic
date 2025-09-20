#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWEB Python - Aplicação Principal
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config.settings import settings
from app.config.database import init_database

# Importar routers
from app.api.v1 import fiscais

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

# Incluir routers das APIs
app.include_router(fiscais.router, prefix="", tags=["Fiscais"])

# Rota raiz
@app.get("/", tags=["Root"])
async def root():
    """Endpoint raiz da API"""
    return {
        "message": "PSWEB Python API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }

# Health check
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
    
    return {
        "status": "ok",
        "database": db_status,
        "version": "2.0.0"
    }

# Static files (frontend)
try:
    app.mount("/static", StaticFiles(directory="../frontend/static"), name="static")
    logger.info("Arquivos estáticos montados em /static")
except Exception as e:
    logger.warning(f"Não foi possível montar arquivos estáticos: {e}")

@app.on_event("startup")
async def startup_event():
    """Inicialização da aplicação"""
    logger.info("Iniciando PSWEB Python API...")
    
    try:
        # Inicializa conexão com banco
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
    logger.info(f"Documentação disponível em: http://{settings.HOST}:{settings.PORT}/docs")
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
