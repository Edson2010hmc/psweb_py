#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARQUIVO: backend/app/services/auth_service.py
PSWEB Python - Serviço de Autenticação via Captura Windows no Servidor
CORREÇÃO: REMOVIDOS TODOS OS TOKENS - APENAS USERNAME WINDOWS
PASSO 2: ADICIONADA VARIÁVEL GLOBAL USERNAME
PASSO 3: USAR USERNAME GLOBAL PARA AUTENTICAÇÃO E DEFINIÇÃO DE PERFIL
"""

import os
import getpass
import socket
import platform
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
from app.config.settings import settings
from app.config.database import db
import logging

logger = logging.getLogger(__name__)

# ===================================================================================================
# VARIÁVEL GLOBAL USERNAME WINDOWS - PASSO 2
# ===================================================================================================

# Variável global que armazena USERNAME Windows capturado
_GLOBAL_USERNAME = None

class AuthService:
    """Serviço de autenticação via captura Windows no servidor - SEM TOKENS"""
    
    def __init__(self):
        pass  # Removido algorithm e access_token_expire_minutes
    
    def get_windows_credentials(self) -> Dict[str, str]:
        """
        Captura credenciais do Windows no servidor Python
        MODIFICADO: Usa variável global se já capturada
        
        Returns:
            {
                "username": str,
                "computer_name": str,
                "domain": str,
                "platform_info": str
            }
        """
        global _GLOBAL_USERNAME
        
        try:
            # Se USERNAME já está na variável global, usa ela
            if _GLOBAL_USERNAME is not None:
                username = _GLOBAL_USERNAME
                logger.info(f"Usando USERNAME da variável global: {username}")
            else:
                # Captura username do Windows pela primeira vez
                username = getpass.getuser()
                logger.info(f"USERNAME capturado do Windows: {username}")
            
            # Captura nome do computador
            computer_name = socket.gethostname().upper()
            
            # Captura domínio (ou WORKGROUP)
            domain = os.environ.get('USERDOMAIN', 'WORKGROUP')
            
            # Informações da plataforma
            platform_info = f"{platform.system()} {platform.release()}"
            
            return {
                "username": username,
                "computer_name": computer_name,
                "domain": domain,
                "platform_info": platform_info,
                "captured_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Erro ao capturar credenciais Windows: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao capturar credenciais do sistema"
            )
    
    async def resolve_user_with_profile(self, identifier: str) -> Optional[Dict[str, Any]]:
        """
        Busca usuário em FISCAIS e ADMINISTRADORES e determina perfil
        
        Args:
            identifier: valor para comparar (nome ou chave conforme AUTH_FIELD)
            
        Returns:
            {
                "fiscal_data": dict ou None,
                "admin_data": dict ou None, 
                "profile": "USUARIO" | "ADMIN",
                "primary_data": dict (dados do usuário principal)
            }
        """
        try:
            # Determina qual campo comparar baseado na configuração
            field_name = settings.AUTH_FIELD  # "NOME" ou "CHAVE"
            
            # Busca em FISCAIS
            fiscal_sql = f"SELECT FIRST 1 FISCALID, NOME, CHAVE, TELEFONE FROM FISCAIS WHERE UPPER({field_name}) = UPPER(?)"
            fiscal_rows = await db.execute_query(fiscal_sql, [identifier.strip()])
            
            fiscal_data = None
            if fiscal_rows:
                row = fiscal_rows[0]
                fiscal_data = {
                    "FiscalId": row[0],
                    "Nome": row[1],
                    "Chave": row[2],
                    "Telefone": row[3],
                    "tipo": "fiscal"
                }
            
            # Busca em ADMINISTRADORES
            admin_sql = f"SELECT FIRST 1 ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES WHERE UPPER({field_name}) = UPPER(?)"
            admin_rows = await db.execute_query(admin_sql, [identifier.strip()])
            
            admin_data = None
            if admin_rows:
                row = admin_rows[0]
                admin_data = {
                    "AdministradorId": row[0],
                    "Nome": row[1],
                    "Chave": row[2],
                    "Telefone": row[3],
                    "tipo": "administrador"
                }
            
            # Determina perfil e dados principais
            if fiscal_data and admin_data:
                # Está nos dois cadastros → perfil ADMIN (precedência)
                profile = "ADMIN"
                primary_data = admin_data
            elif admin_data:
                # Só administrador → perfil ADMIN
                profile = "ADMIN"
                primary_data = admin_data
            elif fiscal_data:
                # Só fiscal → perfil USUARIO
                profile = "USUARIO"
                primary_data = fiscal_data
            else:
                # Não encontrado em nenhum cadastro
                return None
            
            return {
                "fiscal_data": fiscal_data,
                "admin_data": admin_data,
                "profile": profile,
                "primary_data": primary_data
            }
            
        except Exception as e:
            logger.error(f"Erro ao resolver usuário com perfil: {e}")
            return None
    
    def log_authentication_attempt(self, windows_creds: Dict[str, Any], success: bool, user_result: Optional[Dict] = None):
        """Log detalhado de tentativas de autenticação para auditoria"""
        try:
            log_data = {
                "timestamp": datetime.now().isoformat(),
                "success": success,
                "windows_username": windows_creds.get("username", "unknown"),
                "windows_computer": windows_creds.get("computer_name", "unknown"),
                "windows_domain": windows_creds.get("domain", "unknown"),
                "platform_info": windows_creds.get("platform_info", "unknown"),
                "auth_field_used": settings.AUTH_FIELD,
                "profile_granted": user_result.get("profile") if user_result else None,
                "fiscal_found": bool(user_result.get("fiscal_data")) if user_result else False,
                "admin_found": bool(user_result.get("admin_data")) if user_result else False
            }
            
            # Log com nível apropriado
            if success:
                logger.info(f"AUTH_SUCCESS: {log_data}")
            else:
                logger.warning(f"AUTH_FAILED: {log_data}")
                
        except Exception as e:
            logger.error(f"Erro no log de autenticação: {e}")
    
    async def authenticate_windows_user(self) -> Dict[str, Any]:
        """
        Autenticação principal via credenciais Windows do servidor
        PASSO 3: MODIFICADO para usar USERNAME da variável global
        
        Returns:
            Contexto do usuário autenticado (SEM TOKEN)
        """
        global _GLOBAL_USERNAME
        
        try:
            # PASSO 3: Usa USERNAME da variável global diretamente
            if _GLOBAL_USERNAME is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="USERNAME global não inicializado. Reinicie o servidor ou inicialize via frontend."
                )
            
            windows_username = _GLOBAL_USERNAME
            logger.info(f"PASSO 3: Usando USERNAME global para autenticação: {windows_username}")
            
            # Monta credenciais Windows usando USERNAME global
            windows_creds = {
                "username": windows_username,
                "computer_name": socket.gethostname().upper(),
                "domain": os.environ.get('USERDOMAIN', 'WORKGROUP'),
                "platform_info": f"{platform.system()} {platform.release()}",
                "captured_at": datetime.now().isoformat()
            }
            
            # PASSO 3: Busca usuário com sistema de perfis usando USERNAME global
            user_result = await self.resolve_user_with_profile(windows_username)
            
            if not user_result:
                self.log_authentication_attempt(windows_creds, False)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Usuário Windows '{windows_username}' não cadastrado como Fiscal ou Administrador"
                )
            
            # PASSO 3: Monta contexto de usuário autenticado usando dados do banco
            user_context = {
                "login": windows_username,
                "nome": user_result["primary_data"]["Nome"],
                "fiscalId": user_result["fiscal_data"]["FiscalId"] if user_result["fiscal_data"] else None,
                "administradorId": user_result["admin_data"]["AdministradorId"] if user_result["admin_data"] else None,
                "profile": user_result["profile"],  # ADMIN ou USUARIO
                "isFiscal": user_result["fiscal_data"] is not None,
                "isAdmin": user_result["admin_data"] is not None,
                "mode": "windows_global_username",
                "auth_field": settings.AUTH_FIELD,
                "windows_computer": windows_creds["computer_name"],
                "windows_domain": windows_creds["domain"],
                "platform_info": windows_creds["platform_info"],
                "authenticated_at": datetime.now().isoformat()
            }
            
            # Log de sucesso
            self.log_authentication_attempt(windows_creds, True, user_result)
            
            logger.info(f"PASSO 3: Autenticação concluída - {user_context['nome']} ({user_context['profile']})")
            
            return user_context
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Erro na autenticação Windows: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno de autenticação"
            )
    
    async def get_auth_info(self) -> Dict[str, Any]:
        """Retorna informações de configuração para o cliente"""
        global _GLOBAL_USERNAME
        
        try:
            # PASSO 3: Prioriza USERNAME global, senão captura
            if _GLOBAL_USERNAME is not None:
                username = _GLOBAL_USERNAME
                computer_name = socket.gethostname().upper()
                domain = os.environ.get('USERDOMAIN', 'WORKGROUP')
                logger.info(f"PASSO 3: Usando USERNAME global para auth info: {username}")
            else:
                # Fallback se não tem USERNAME global
                windows_creds = self.get_windows_credentials()
                username = windows_creds["username"]
                computer_name = windows_creds["computer_name"]
                domain = windows_creds["domain"]
            
            return {
                "auth_field": settings.AUTH_FIELD,
                "auth_mode": "windows_global_username",
                "server_time": datetime.now().isoformat(),
                "message": f"Sistema usa USERNAME global Windows. Campo de busca: {settings.AUTH_FIELD}",
                "global_username_initialized": _GLOBAL_USERNAME is not None,
                "windows_info": {
                    "username": username,
                    "computer": computer_name,
                    "domain": domain
                }
            }
        except Exception as e:
            logger.error(f"Erro ao obter informações de auth: {e}")
            return {
                "auth_field": settings.AUTH_FIELD,
                "auth_mode": "windows_global_username",
                "server_time": datetime.now().isoformat(),
                "message": "Erro ao capturar informações Windows",
                "global_username_initialized": False,
                "error": str(e)
            }

# ===================================================================================================
# FUNÇÕES PARA VARIÁVEL GLOBAL USERNAME - PASSO 2
# ===================================================================================================

def initialize_global_username() -> bool:
    """
    NOVA FUNÇÃO: Inicializa variável global USERNAME
    Chamada quando frontend carregar ou servidor iniciar
    """
    global _GLOBAL_USERNAME
    
    try:
        # Se já está inicializada, não faz nada
        if _GLOBAL_USERNAME is not None:
            logger.info(f"USERNAME global já inicializado: {_GLOBAL_USERNAME}")
            return True
        
        # Captura USERNAME do Windows pela primeira vez
        username = getpass.getuser()
        
        # Armazena na variável global
        _GLOBAL_USERNAME = username
        
        logger.info(f"✅ USERNAME global inicializado: {_GLOBAL_USERNAME}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Erro ao inicializar USERNAME global: {e}")
        _GLOBAL_USERNAME = None
        return False

def get_global_username() -> Optional[str]:
    """
    NOVA FUNÇÃO: Retorna USERNAME da variável global
    """
    global _GLOBAL_USERNAME
    return _GLOBAL_USERNAME

def clear_global_username():
    """
    NOVA FUNÇÃO: Limpa variável global USERNAME
    Usada quando encerrar código ou resetar
    """
    global _GLOBAL_USERNAME
    old_username = _GLOBAL_USERNAME
    _GLOBAL_USERNAME = None
    logger.info(f"USERNAME global limpo (era: {old_username})")

def is_global_username_initialized() -> bool:
    """
    NOVA FUNÇÃO: Verifica se USERNAME global está inicializado
    """
    global _GLOBAL_USERNAME
    return _GLOBAL_USERNAME is not None

# ===================================================================================================
# FUNÇÕES UTILITÁRIAS PARA AUTENTICAÇÃO E PERFIL - PASSO 3
# ===================================================================================================

async def get_current_user_profile() -> Optional[str]:
    """
    NOVA FUNÇÃO - PASSO 3: Retorna perfil do usuário atual usando USERNAME global
    Returns: "ADMIN" | "USUARIO" | None
    """
    global _GLOBAL_USERNAME
    
    if _GLOBAL_USERNAME is None:
        return None
    
    try:
        auth_service_instance = AuthService()
        user_result = await auth_service_instance.resolve_user_with_profile(_GLOBAL_USERNAME)
        return user_result.get("profile") if user_result else None
    except Exception as e:
        logger.error(f"Erro ao obter perfil do usuário: {e}")
        return None

async def get_current_user_data() -> Optional[Dict[str, Any]]:
    """
    NOVA FUNÇÃO - PASSO 3: Retorna dados completos do usuário usando USERNAME global
    """
    global _GLOBAL_USERNAME
    
    if _GLOBAL_USERNAME is None:
        return None
    
    try:
        auth_service_instance = AuthService()
        return await auth_service_instance.resolve_user_with_profile(_GLOBAL_USERNAME)
    except Exception as e:
        logger.error(f"Erro ao obter dados do usuário: {e}")
        return None

async def get_current_fiscal_id() -> Optional[int]:
    """
    NOVA FUNÇÃO - PASSO 3: Retorna FiscalId do usuário usando USERNAME global
    """
    user_data = await get_current_user_data()
    if user_data and user_data.get("fiscal_data"):
        return user_data["fiscal_data"]["FiscalId"]
    return None

async def get_current_user_name() -> Optional[str]:
    """
    NOVA FUNÇÃO - PASSO 3: Retorna nome do usuário do banco usando USERNAME global
    """
    user_data = await get_current_user_data()
    if user_data and user_data.get("primary_data"):
        return user_data["primary_data"]["Nome"]
    return None

async def is_current_user_admin() -> bool:
    """
    NOVA FUNÇÃO - PASSO 3: Verifica se usuário atual é ADMIN usando USERNAME global
    """
    profile = await get_current_user_profile()
    return profile == "ADMIN"

async def is_current_user_fiscal() -> bool:
    """
    NOVA FUNÇÃO - PASSO 3: Verifica se usuário atual é fiscal usando USERNAME global
    """
    user_data = await get_current_user_data()
    return user_data is not None and user_data.get("fiscal_data") is not None

# Instância global
auth_service = AuthService()

# REMOVIDAS: Todas as dependências relacionadas a tokens
# REMOVIDAS: get_current_user, require_auth, require_admin
# REMOVIDAS: create_access_token, verify_token
# REMOVIDAS: Imports de JWT, jose, HTTPBearer, HTTPAuthorizationCredentials

# Funções utilitárias de permissão (mantidas)
def can_edit_ps(ps_data: Dict[str, Any], user: Dict[str, Any]) -> bool:
    """Verifica se usuário pode editar PS"""
    return (
        ps_data.get("Status") == "RASCUNHO" and
        ps_data.get("FiscalDesembarcandoId") == user.get("fiscalId")
    )