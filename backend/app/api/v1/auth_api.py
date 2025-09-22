#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARQUIVO: backend/app/api/v1/auth_api.py
API de Autenticação - Captura Windows no Servidor - SEM TOKENS
PASSO 2: ADICIONADA rota para inicializar USERNAME global
PASSO 3: USAR USERNAME GLOBAL PARA AUTENTICAÇÃO E DEFINIÇÃO DE PERFIL
"""

from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any
from pydantic import BaseModel
from app.services.auth_service import auth_service
from app.config.database import db
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

# === MODELS (SEM TOKEN) ===
class AuthResponse(BaseModel):
    """Resposta de autenticação bem-sucedida - SEM TOKEN"""
    success: bool = True
    user: Dict[str, Any]
    profile: str
    message: str

class AuthInfoResponse(BaseModel):
    """Informações de configuração de autenticação"""
    auth_field: str
    auth_mode: str
    server_time: str
    message: str
    global_username_initialized: bool
    windows_info: Dict[str, Any]

class InitUsernameResponse(BaseModel):
    """Resposta da inicialização do USERNAME global"""
    success: bool
    username: str | None
    message: str
    already_initialized: bool

class CurrentUserResponse(BaseModel):
    """NOVA - PASSO 3: Resposta com dados do usuário atual usando USERNAME global"""
    success: bool
    user: Dict[str, Any] | None
    profile: str | None
    message: str

# === ROTAS PRINCIPAIS ===

@router.get("/info", response_model=AuthInfoResponse)
async def get_auth_info():
    """
    Retorna informações de configuração para o cliente
    MODIFICADO: Inclui status da variável global USERNAME
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

@router.post("/init-username", response_model=InitUsernameResponse)
async def initialize_username():
    """
    NOVA ROTA - PASSO 2: Inicializa variável global USERNAME
    Chamada pelo frontend quando carregar
    """
    try:
        from app.services.auth_service import (
            initialize_global_username, 
            get_global_username, 
            is_global_username_initialized
        )
        
        # Verifica se já está inicializada
        already_initialized = is_global_username_initialized()
        
        if already_initialized:
            username = get_global_username()
            logger.info(f"USERNAME global já inicializado: {username}")
            return InitUsernameResponse(
                success=True,
                username=username,
                message=f"USERNAME já inicializado: {username}",
                already_initialized=True
            )
        
        # Inicializa USERNAME global
        success = initialize_global_username()
        
        if success:
            username = get_global_username()
            logger.info(f"USERNAME global inicializado via frontend: {username}")
            return InitUsernameResponse(
                success=True,
                username=username,
                message=f"USERNAME inicializado com sucesso: {username}",
                already_initialized=False
            )
        else:
            logger.error("Falha ao inicializar USERNAME global via frontend")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao inicializar USERNAME Windows"
            )
            
    except Exception as e:
        logger.error(f"Erro ao inicializar USERNAME: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao inicializar USERNAME: {str(e)}"
        )

@router.post("/windows", response_model=AuthResponse)
async def authenticate_windows():
    """
    Autenticação via credenciais Windows capturadas no servidor
    PASSO 3: MODIFICADO para usar USERNAME global
    """
    try:
        # PASSO 3: Autentica usando USERNAME global
        user_context = await auth_service.authenticate_windows_user()
        
        # Resposta de sucesso SEM TOKEN
        response = AuthResponse(
            user=user_context,
            profile=user_context["profile"],
            message=f"PASSO 3: Autenticado como {user_context['profile']} - {user_context['nome']}"
        )
        
        logger.info(f"PASSO 3: Autenticação concluída - {user_context['login']} ({user_context['profile']})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na autenticação Windows: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno na autenticação Windows"
        )

@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user():
    """
    NOVA ROTA - PASSO 3: Retorna dados do usuário atual usando USERNAME global
    Substitui verificação de token por consulta direta via USERNAME global
    """
    try:
        from app.services.auth_service import (
            get_global_username,
            get_current_user_data,
            get_current_user_profile,
            get_current_user_name,
            get_current_fiscal_id,
            is_current_user_admin,
            is_current_user_fiscal
        )
        
        # Verifica se USERNAME global está inicializado
        username = get_global_username()
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="USERNAME global não inicializado"
            )
        
        # PASSO 3: Busca dados do usuário usando USERNAME global
        user_data = await get_current_user_data()
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Usuário '{username}' não encontrado nos cadastros"
            )
        
        # Monta contexto do usuário atual
        user_context = {
            "login": username,
            "nome": await get_current_user_name(),
            "fiscalId": await get_current_fiscal_id(),
            "administradorId": user_data["admin_data"]["AdministradorId"] if user_data.get("admin_data") else None,
            "profile": await get_current_user_profile(),
            "isFiscal": await is_current_user_fiscal(),
            "isAdmin": await is_current_user_admin(),
            "mode": "windows_global_username",
            "auth_field": settings.AUTH_FIELD
        }
        
        profile = await get_current_user_profile()
        
        logger.info(f"PASSO 3: Dados do usuário obtidos via USERNAME global - {user_context['nome']} ({profile})")
        
        return CurrentUserResponse(
            success=True,
            user=user_context,
            profile=profile,
            message=f"Usuário atual: {user_context['nome']} ({profile})"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter dados do usuário atual: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter dados do usuário: {str(e)}"
        )

@router.post("/logout")
async def logout():
    """
    Logout do usuário - SEM TOKENS
    MANTIDO: Funcionalidade inalterada
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
    

@router.get("/photo")
async def get_user_photo():
    """
    Busca foto do usuário via API Petrobras usando chave do banco
    """
    try:
        from app.services.auth_service import get_current_user_data
        import requests
        
        # Obtém dados do usuário atual
        user_data = await get_current_user_data()
        if not user_data or not user_data.get("fiscal_data"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        
        # Pega chave do fiscal
        chave = user_data["fiscal_data"]["Chave"]
        
        # Chama API Petrobras
        api_url = f"https://spo.petrobras.com.br/carest/api/buscaEmpregado?chave={chave}"
        
        response = requests.get(api_url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("boolean") and data.get("user", {}).get("imagem"):
                photo_url = data["user"]["imagem"]
                
                # *** CORREÇÃO: Converter HTTP para HTTPS ***
                if photo_url.startswith("http://"):
                    photo_url = photo_url.replace("http://", "https://")
                
                return {"success": True, "photo_url": photo_url}
        
        # Fallback se não encontrar
        return {"success": False, "photo_url": None}
        
    except requests.exceptions.RequestException:
        return {"success": False, "photo_url": None}
    except Exception as e:
        logger.error(f"Erro ao buscar foto: {e}")
        return {"success": False, "photo_url": None}






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
    
    @router.get("/debug-username")
    async def debug_global_username():
        """
        [DEBUG] NOVA ROTA - Mostra status da variável global USERNAME
        """
        try:
            from app.services.auth_service import (
                get_global_username, 
                is_global_username_initialized
            )
            
            return {
                "success": True,
                "debug_mode": True,
                "global_username": get_global_username(),
                "is_initialized": is_global_username_initialized(),
                "message": "Status da variável global USERNAME"
            }
        except Exception as e:
            logger.error(f"Erro no debug USERNAME: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro no debug USERNAME: {str(e)}"
            )
    
    @router.get("/debug-profile")
    async def debug_current_profile():
        """
        [DEBUG] NOVA ROTA - PASSO 3: Mostra perfil do usuário atual via USERNAME global
        """
        try:
            from app.services.auth_service import (
                get_global_username,
                get_current_user_profile,
                get_current_user_data,
                is_current_user_admin,
                is_current_user_fiscal
            )
            
            username = get_global_username()
            profile = await get_current_user_profile()
            user_data = await get_current_user_data()
            is_admin = await is_current_user_admin()
            is_fiscal = await is_current_user_fiscal()
            
            return {
                "success": True,
                "debug_mode": True,
                "global_username": username,
                "current_profile": profile,
                "is_admin": is_admin,
                "is_fiscal": is_fiscal,
                "full_user_data": user_data,
                "message": f"PASSO 3: Perfil do usuário {username}: {profile}"
            }
            
        except Exception as e:
            logger.error(f"Erro no debug de perfil: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro no debug de perfil: {str(e)}"
            )
    
    @router.get("/debug-full")
    async def debug_full_auth():
        """
        [DEBUG] DEBUG COMPLETO: Testa todo o fluxo de autenticação
        PASSO 3: MODIFICADO para usar USERNAME global
        """
        try:
            from app.services.auth_service import get_global_username
            
            # PASSO 3: Usa USERNAME global em vez de capturar novamente
            windows_username = get_global_username()
            if not windows_username:
                return {
                    "success": False,
                    "debug_mode": True,
                    "error": "USERNAME global não inicializado",
                    "message": "PASSO 3: USERNAME global deve estar inicializado primeiro"
                }
            
            # 1. Informações Windows usando USERNAME global
            windows_creds = auth_service.get_windows_credentials()
            
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
                    "step_0_passo3": {
                        "using_global_username": True,
                        "global_username": windows_username,
                        "message": "PASSO 3: Usando USERNAME da variável global"
                    },
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
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro no debug: {str(e)}"
            )
    
    @router.get("/debug-config")
    async def debug_config():
        """
        [DEBUG] Configuração de autenticação para frontend
        MANTIDO: Funcionalidade inalterada
        """
        return {
            "config": {
                "DEBUG": settings.DEBUG,
                "DEBUG_AUTH": settings.DEBUG_AUTH,
                "DEBUG_ROUTES": settings.DEBUG_ROUTES,
                "AUTH_FIELD": settings.AUTH_FIELD
            }
        }