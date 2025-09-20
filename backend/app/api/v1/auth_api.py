#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Autenticação - Rotas para JavaScript Client
Arquivo: backend/app/api/v1/auth_api.py
"""

from fastapi import APIRouter, HTTPException, status, Request
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import timedelta
from app.services.auth_service import auth_service, require_auth
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])

# === MODELS ===
class ClientAuthData(BaseModel):
    """Dados enviados pelo cliente JavaScript para autenticação"""
    username: str = Field(..., min_length=2, max_length=50, description="Username da máquina cliente")
    computerName: str = Field(..., min_length=1, max_length=100, description="Nome do computador cliente")
    domain: Optional[str] = Field(None, max_length=100, description="Domínio do computador cliente")
    clientIP: Optional[str] = Field(None, description="IP do cliente (se disponível)")
    userAgent: Optional[str] = Field(None, description="User-Agent do navegador")
    timestamp: int = Field(..., description="Timestamp do cliente (JavaScript Date.now())")
    additional_info: Optional[Dict[str, Any]] = Field(None, description="Informações adicionais do cliente")

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

# === ROTAS ===

@router.get("/info", response_model=AuthInfoResponse)
async def get_auth_info():
    """
    Retorna informações de configuração para o cliente
    Usado pelo frontend para saber como fazer autenticação
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

@router.post("/client", response_model=AuthResponse)
async def authenticate_client(client_data: ClientAuthData, request: Request):
    """
    Autenticação principal via dados do cliente JavaScript
    """
    try:
        # Adiciona IP do request se não foi enviado
        client_data_dict = client_data.dict()
        if not client_data_dict.get("clientIP"):
            client_data_dict["clientIP"] = request.client.host
        
        # Autentica via service
        user_context = await auth_service.authenticate_client(client_data_dict)
        
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
        
        logger.info(f"Autenticação bem-sucedida: {user_context['login']} ({user_context['profile']})")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na autenticação do cliente: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno na autenticação"
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