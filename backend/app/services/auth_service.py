#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWEB Python - Serviço de Autenticação via Captura Windows no Servidor
Autenticação baseada em credenciais capturadas diretamente no servidor
"""

import os
import getpass
import socket
import platform
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.config.settings import settings
from app.config.database import db
import logging

logger = logging.getLogger(__name__)

# Configuração de segurança
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

class AuthService:
    """Serviço de autenticação via captura Windows no servidor"""
    
    def __init__(self):
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
    
    def get_windows_credentials(self) -> Dict[str, str]:
        """
        Captura credenciais do Windows no servidor Python
        
        Returns:
            {
                "username": str,
                "computer_name": str,
                "domain": str,
                "platform_info": str
            }
        """
        try:
            # Captura username do Windows
            username = getpass.getuser()
            
            # Captura nome do computador
            computer_name = socket.gethostname().upper()
            
            # Captura domínio (ou WORKGROUP)
            domain = os.environ.get('USERDOMAIN', 'WORKGROUP')
            
            # Informações da plataforma
            platform_info = f"{platform.system()} {platform.release()}"
            
            logger.info(f"Credenciais Windows capturadas - User: {username}, Computer: {computer_name}, Domain: {domain}")
            
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
        
        Returns:
            Contexto do usuário autenticado
        """
        try:
            # Captura credenciais Windows do servidor
            windows_creds = self.get_windows_credentials()
            windows_username = windows_creds["username"]
            
            # Busca usuário com sistema de perfis
            user_result = await self.resolve_user_with_profile(windows_username)
            
            if not user_result:
                self.log_authentication_attempt(windows_creds, False)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Usuário Windows '{windows_username}' não cadastrado como Fiscal ou Administrador"
                )
            
            # Monta contexto de usuário autenticado
            user_context = {
                "login": windows_username,
                "nome": user_result["primary_data"]["Nome"],
                "fiscalId": user_result["fiscal_data"]["FiscalId"] if user_result["fiscal_data"] else None,
                "administradorId": user_result["admin_data"]["AdministradorId"] if user_result["admin_data"] else None,
                "profile": user_result["profile"],
                "isFiscal": user_result["fiscal_data"] is not None,
                "isAdmin": user_result["admin_data"] is not None,
                "mode": "windows_server",
                "auth_field": settings.AUTH_FIELD,
                "windows_computer": windows_creds["computer_name"],
                "windows_domain": windows_creds["domain"],
                "platform_info": windows_creds["platform_info"],
                "authenticated_at": datetime.now().isoformat()
            }
            
            # Log de sucesso
            self.log_authentication_attempt(windows_creds, True, user_result)
            
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
        try:
            # Captura informações básicas do Windows para teste
            windows_creds = self.get_windows_credentials()
            
            return {
                "auth_field": settings.AUTH_FIELD,
                "auth_mode": "windows_server",
                "server_time": datetime.now().isoformat(),
                "message": f"Sistema requer autenticação Windows via {settings.AUTH_FIELD.lower()} cadastrado",
                "windows_info": {
                    "username": windows_creds["username"],
                    "computer": windows_creds["computer_name"],
                    "domain": windows_creds["domain"]
                }
            }
        except Exception as e:
            logger.error(f"Erro ao obter informações de auth: {e}")
            return {
                "auth_field": settings.AUTH_FIELD,
                "auth_mode": "windows_server",
                "server_time": datetime.now().isoformat(),
                "message": "Erro ao capturar informações Windows",
                "error": str(e)
            }
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Cria JWT token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verifica e decodifica JWT token"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

# Instância global
auth_service = AuthService()

# Dependências FastAPI
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Dependency para obter usuário atual nas rotas"""
    
    # Se tem token JWT, verifica
    if credentials:
        user_data = auth_service.verify_token(credentials.credentials)
        if user_data:
            return user_data
    
    # Sem token válido
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token de autenticação requerido"
    )

async def require_auth(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency que requer autenticação válida"""
    if not user or not (user.get("fiscalId") or user.get("administradorId")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação requerida"
        )
    return user

async def require_admin(user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    """Dependency que requer perfil ADMIN"""
    if user.get("profile") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores"
        )
    return user

# Funções utilitárias de permissão
def can_edit_ps(ps_data: Dict[str, Any], user_context: Dict[str, Any]) -> bool:
    """Verifica se usuário pode editar a PS"""
    try:
        from datetime import datetime, timedelta
        
        # Verifica status
        status_ps = ps_data.get("Status") or ps_data.get("STATUS")
        if status_ps != "RASCUNHO":
            return False
        
        # Verifica janela temporal (até 1 dia após fim do período)
        periodo_fim = ps_data.get("PeriodoFim") or ps_data.get("PERIODOFIM")
        if periodo_fim:
            if isinstance(periodo_fim, str):
                try:
                    fim_date = datetime.strptime(periodo_fim, "%Y-%m-%d").date()
                except:
                    fim_date = datetime.strptime(periodo_fim[:10], "%Y-%m-%d").date()
            else:
                fim_date = periodo_fim
            
            limite = fim_date + timedelta(days=1)
            if datetime.now().date() > limite:
                return False
        
        # Verifica se é o fiscal desembarcando
        fiscal_desemb_id = ps_data.get("FiscalDesembarcandoId") or ps_data.get("FISCALDESEMBARCANDOID")
        user_fiscal_id = user_context.get("fiscalId")
        
        return fiscal_desemb_id == user_fiscal_id
        
    except Exception as e:
        logger.error(f"Erro ao verificar permissão de edição: {e}")
        return False

def has_ps_access(ps_data: Dict[str, Any], user_context: Dict[str, Any]) -> bool:
    """Verifica se usuário tem acesso à PS (visualização)"""
    try:
        user_fiscal_id = user_context.get("fiscalId")
        fiscal_emb_id = ps_data.get("FiscalEmbarcandoId") or ps_data.get("FISCALEMBARCANDOID")
        fiscal_desemb_id = ps_data.get("FiscalDesembarcandoId") or ps_data.get("FISCALDESEMBARCANDOID")
        
        # Administradores têm acesso a todas as PS
        if user_context.get("profile") == "ADMIN":
            return True
        
        # Fiscais só têm acesso às suas PS
        return user_fiscal_id in [fiscal_emb_id, fiscal_desemb_id]
        
    except Exception as e:
        logger.error(f"Erro ao verificar acesso à PS: {e}")
        return False