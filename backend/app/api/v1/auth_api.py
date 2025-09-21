#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARQUIVO: backend/app/api/v1/auth_api.py
API de Autenticação - Captura Windows no Servidor - COM DEBUG CONDICIONAL
"""

from fastapi import APIRouter, HTTPException, status, Request
from typing import Dict, Any
from pydantic import BaseModel
from datetime import timedelta
from app.services.auth_service import auth_service, require_auth
from app.config.database import db
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

# === MODELS ===
class AuthResponse(BaseModel):
    """Resposta de autenticação bem-sucedida"""
    success: bool = True
    token: str
    user: Dict[str, Any]
    profile: str
    message: str

class AuthInfoResponse(BaseModel):
    """Informações de configuração de autenticação"""
    auth_field: str
    auth_mode: str
    server_time: str
    message: str
    windows_info: Dict[str, Any]

# === ROTAS PRINCIPAIS ===

@router.get("/info", response_model=AuthInfoResponse)
async def get_auth_info():
    """
    Retorna informações de configuração para o cliente
    Inclui informações Windows capturadas no servidor
    """
    try:
        info = await auth_service.get_auth_info()
        return AuthInfoResponse(**info)
    except Exception as e:
        logger.error(f"Erro ao obter informações de auth: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao obter configurações de autenticação"
        )

@router.post("/windows", response_model=AuthResponse)
async def authenticate_windows():
    """
    Autenticação via credenciais Windows capturadas no servidor
    Não requer dados do cliente - usa getpass.getuser() no servidor
    """
    try:
        # Autentica via service (captura Windows no servidor)
        user_context = await auth_service.authenticate_windows_user()
        
        # Cria token JWT
        token_data = {
            "sub": user_context["login"],
            "nome": user_context["nome"],
            "fiscalId": user_context["fiscalId"],
            "administradorId": user_context["administradorId"],
            "profile": user_context["profile"],
            "isFiscal": user_context["isFiscal"],
            "isAdmin": user_context["isAdmin"],
            "mode": user_context["mode"],
            "auth_field": user_context["auth_field"]
        }
        
        token = auth_service.create_access_token(
            data=token_data,
            expires_delta=timedelta(minutes=auth_service.access_token_expire_minutes)
        )
        
        # Resposta de sucesso
        response = AuthResponse(
            token=token,
            user=user_context,
            profile=user_context["profile"],
            message=f"Autenticado como {user_context['profile']} - {user_context['nome']}"
        )
        
        logger.info(f"Autenticação Windows bem-sucedida: {user_context['login']} ({user_context['profile']})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na autenticação Windows: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno na autenticação Windows"
        )

@router.post("/logout")
async def logout():
    """
    Logout do usuário
    Em um sistema JWT stateless, o logout é feito no frontend (descartando o token)
    Esta rota existe para consistência e pode registrar logs de logout
    """
    try:
        logger.info("Logout realizado")
        return {"success": True, "message": "Logout realizado com sucesso"}
    except Exception as e:
        logger.error(f"Erro no logout: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro no logout"
        )

@router.get("/me")
async def get_current_user_info(user: Dict[str, Any] = require_auth):
    """
    Retorna informações do usuário autenticado atual
    Usado pelo frontend para verificar se ainda está autenticado
    """
    try:
        return {
            "success": True,
            "user": user,
            "authenticated": True
        }
    except Exception as e:
        logger.error(f"Erro ao obter informações do usuário: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao obter informações do usuário"
        )

@router.get("/validate")
async def validate_token(user: Dict[str, Any] = require_auth):
    """
    Valida se o token atual ainda é válido
    Retorna informações básicas do usuário se válido
    """
    try:
        return {
            "valid": True,
            "profile": user.get("profile"),
            "nome": user.get("nome"),
            "expires_soon": False  # TODO: implementar verificação de expiração próxima
        }
    except Exception as e:
        logger.error(f"Erro na validação de token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro na validação"
        )

# === ROTAS DE DEBUG - CONDICIONAIS ===

if settings.DEBUG_AUTH:
    logger.info("🔧 Rotas de DEBUG AUTH habilitadas")
    
    @router.get("/test-windows")
    async def test_windows_capture():
        """
        [DEBUG] Rota de teste para verificar captura Windows no servidor
        Útil para desenvolvimento e debug
        """
        try:
            windows_creds = auth_service.get_windows_credentials()
            return {
                "success": True,
                "windows_credentials": windows_creds,
                "message": "Credenciais Windows capturadas com sucesso no servidor",
                "debug_mode": True
            }
        except Exception as e:
            logger.error(f"Erro no teste de captura Windows: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao capturar credenciais Windows: {str(e)}"
            )
    
    @router.get("/debug-full")
    async def debug_full_auth():
        """
        [DEBUG] DEBUG COMPLETO: Testa todo o fluxo de autenticação
        """
        try:
            # 1. Captura credenciais Windows
            windows_creds = auth_service.get_windows_credentials()
            windows_username = windows_creds["username"]
            
            # 2. Busca em FISCAIS
            fiscal_sql = f"SELECT FIRST 1 FISCALID, NOME, CHAVE, TELEFONE FROM FISCAIS WHERE UPPER({settings.AUTH_FIELD}) = UPPER(?)"
            fiscal_rows = await db.execute_query(fiscal_sql, [windows_username.strip()])
            
            # 3. Busca em ADMINISTRADORES  
            admin_sql = f"SELECT FIRST 1 ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES WHERE UPPER({settings.AUTH_FIELD}) = UPPER(?)"
            admin_rows = await db.execute_query(admin_sql, [windows_username.strip()])
            
            # 4. Testa o resolve_user_with_profile
            user_result = await auth_service.resolve_user_with_profile(windows_username)
            
            # 5. Lista todos os fiscais e administradores para comparação
            all_fiscais = await db.execute_query("SELECT FISCALID, NOME, CHAVE FROM FISCAIS ORDER BY NOME")
            all_admins = await db.execute_query("SELECT ADMINISTRADORID, NOME, CHAVE FROM ADMINISTRADORES ORDER BY NOME")
            
            return {
                "success": True,
                "debug_mode": True,
                "debug_info": {
                    "step_1_windows": {
                        "username": windows_username,
                        "computer": windows_creds["computer_name"],
                        "domain": windows_creds["domain"]
                    },
                    "step_2_auth_config": {
                        "auth_field": settings.AUTH_FIELD,
                        "search_value": windows_username.strip(),
                        "search_value_upper": windows_username.strip().upper()
                    },
                    "step_3_fiscal_search": {
                        "sql": fiscal_sql,
                        "found": len(fiscal_rows) > 0,
                        "data": fiscal_rows[0] if fiscal_rows else None
                    },
                    "step_4_admin_search": {
                        "sql": admin_sql, 
                        "found": len(admin_rows) > 0,
                        "data": admin_rows[0] if admin_rows else None
                    },
                    "step_5_final_result": user_result,
                    "step_6_expected_profile": user_result.get("profile") if user_result else "NOT_FOUND",
                    "step_7_all_fiscais": all_fiscais,
                    "step_8_all_admins": all_admins,
                    "step_9_comparison": {
                        "windows_user_matches_fiscal": any(
                            windows_username.strip().upper() == str(f[1]).strip().upper() if settings.AUTH_FIELD == 'NOME' 
                            else windows_username.strip().upper() == str(f[2]).strip().upper()
                            for f in all_fiscais
                        ),
                        "windows_user_matches_admin": any(
                            windows_username.strip().upper() == str(a[1]).strip().upper() if settings.AUTH_FIELD == 'NOME'
                            else windows_username.strip().upper() == str(a[2]).strip().upper()
                            for a in all_admins
                        )
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Erro no debug completo: {e}")
            import traceback
            return {
                "success": False,
                "debug_mode": True,
                "error": str(e),
                "traceback": traceback.format_exc()
            }
    
    @router.get("/debug-config")
    async def debug_config():
        """
        [DEBUG] Mostra configuração atual do sistema de autenticação
        """
        return {
            "success": True,
            "debug_mode": True,
            "config": {
                "AUTH_FIELD": settings.AUTH_FIELD,
                "DEBUG": settings.DEBUG,
                "DEBUG_AUTH": settings.DEBUG_AUTH,
                "DEBUG_ROUTES": settings.DEBUG_ROUTES,
                "USE_WINDOWS_AUTH": settings.USE_WINDOWS_AUTH
            },
            "message": "Configuração atual do sistema de autenticação"
        }

else:
    logger.info("🔒 Rotas de DEBUG AUTH desabilitadas (production mode)")