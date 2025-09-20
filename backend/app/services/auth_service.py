#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWEB Python - Serviço de Autenticação
Compatível com autenticação Windows + Login Manual
"""

import os
import getpass
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.config.settings import settings
from app.db.firebird_connection import fb_query

# Configuração de segurança
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

class AuthService:
    """Serviço de autenticação compatível com Node.js"""
    
    def __init__(self):
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
    
    def get_windows_user(self) -> Optional[str]:
        """Obtém usuário Windows atual"""
        try:
            # Windows
            windows_user = os.environ.get('USERNAME')
            if windows_user:
                return windows_user
                
            # Fallback Unix-like
            unix_user = os.environ.get('USER') 
            if unix_user:
                return unix_user
                
            # Fallback getpass
            return getpass.getuser()
            
        except Exception:
            return None
    
    async def resolve_fiscal_by_name(self, nome: str) -> Optional[Dict[str, Any]]:
        """Busca fiscal pelo nome completo"""
        try:
            fiscais = fb_query.execute_query(
                "SELECT FIRST 1 FiscalId, Nome, Chave, Telefone FROM Fiscais WHERE UPPER(Nome)=UPPER(?)", 
                [nome.strip()]
            )
            return fiscais[0] if fiscais else None
        except Exception as e:
            print(f"Erro ao buscar fiscal: {e}")
            return None
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Cria JWT token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
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
    
    async def authenticate_windows(self) -> Optional[Dict[str, Any]]:
        """Autenticação via usuário Windows"""
        if not settings.USE_WINDOWS_AUTH:
            return None
            
        windows_user = self.get_windows_user()
        if not windows_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credencial Windows não disponível"
            )
        
        # Busca o fiscal pelo nome do usuário Windows
        fiscal = await self.resolve_fiscal_by_name(windows_user)
        if not fiscal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário Windows não cadastrado na lista de fiscais"
            )
        
        # Cria contexto de usuário compatível com Node.js
        user_context = {
            "login": windows_user,
            "nome": fiscal["Nome"],
            "fiscalId": fiscal["FiscalId"],
            "mode": "windows"
        }
        
        return user_context
    
    async def authenticate_manual(self, nome: str) -> Dict[str, Any]:
        """Autenticação manual por nome"""
        if settings.USE_WINDOWS_AUTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Login manual desativado em produção"
            )
        
        if not nome or not nome.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe seu nome completo"
            )
        
        fiscal = await self.resolve_fiscal_by_name(nome.strip())
        if not fiscal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário não cadastrado na lista de fiscais"
            )
        
        user_context = {
            "login": nome.strip(),
            "nome": fiscal["Nome"],
            "fiscalId": fiscal["FiscalId"],
            "mode": "manual"
        }
        
        return user_context
    
    async def get_current_user_context(self) -> Dict[str, Any]:
        """Obtém contexto do usuário atual (Windows ou manual)"""
        try:
            if settings.USE_WINDOWS_AUTH:
                return await self.authenticate_windows()
            else:
                # Em modo manual, retorna erro - precisa fazer login
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Sessão não iniciada. Faça login manual."
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro de autenticação: {str(e)}"
            )

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
    
    # Senão, tenta autenticação direta
    try:
        return await auth_service.get_current_user_context()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível autenticar usuário"
        )

async def require_auth(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Dependency que requer autenticação válida"""
    if not user or not user.get("fiscalId"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação requerida"
        )
    return user

# Funções utilitárias de permissão (compatíveis com Node.js)
def can_edit_ps(ps_data: Dict[str, Any], user_context: Dict[str, Any]) -> bool:
    """Verifica se usuário pode editar a PS (regras do Node.js)"""
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
                # Converte string para date
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
        print(f"Erro ao verificar permissão de edição: {e}")
        return False

def has_ps_access(ps_data: Dict[str, Any], user_context: Dict[str, Any]) -> bool:
    """Verifica se usuário tem acesso à PS (visualização)"""
    try:
        user_fiscal_id = user_context.get("fiscalId")
        fiscal_emb_id = ps_data.get("FiscalEmbarcandoId") or ps_data.get("FISCALEMBARCANDOID")
        fiscal_desemb_id = ps_data.get("FiscalDesembarcandoId") or ps_data.get("FISCALDESEMBARCANDOID")
        
        return user_fiscal_id in [fiscal_emb_id, fiscal_desemb_id]
        
    except Exception as e:
        print(f"Erro ao verificar acesso à PS: {e}")
        return False

# Teste do serviço
if __name__ == "__main__":
    import asyncio
    
    async def test_auth():
        try:
            # Teste autenticação Windows
            if settings.USE_WINDOWS_AUTH:
                print("Testando autenticação Windows...")
                user = await auth_service.authenticate_windows()
                print(f"Usuário autenticado: {user}")
            else:
                print("Autenticação Windows desabilitada")
            
        except Exception as e:
            print(f"Erro no teste: {e}")
    
    # asyncio.run(test_auth())
    print("Módulo de autenticação carregado")