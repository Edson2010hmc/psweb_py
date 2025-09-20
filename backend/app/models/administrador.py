#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelo Administrador - CHAVE deve ter 4 caracteres exatos
Localização: backend/app/models/administrador.py
"""

from pydantic import BaseModel, Field, validator
from typing import Optional

class AdministradorBase(BaseModel):
    """Modelo base para Administrador - CHAVE deve ter 4 caracteres exatos"""
    nome: str = Field(..., min_length=1, max_length=120, description="Nome completo do administrador")
    chave: str = Field(..., min_length=4, max_length=4, description="Chave de 4 caracteres EXATOS")
    telefone: Optional[str] = Field(None, max_length=40, description="Telefone de contato")

    @validator('chave')
    def validate_chave(cls, v):
        """Valida que a chave tem EXATAMENTE 4 caracteres"""
        if not v:
            raise ValueError('Chave é obrigatória')
        
        chave_clean = v.strip()
        if len(chave_clean) != 4:
            raise ValueError('Chave deve ter exatamente 4 caracteres')
        
        return chave_clean.upper()

    @validator('telefone')
    def validate_telefone(cls, v):
        """Valida o telefone"""
        if v and len(v) > 40:
            raise ValueError('Telefone deve ter no máximo 40 caracteres')
        return v.strip() if v else None

    @validator('nome')
    def validate_nome(cls, v):
        """Valida o nome"""
        if not v or not v.strip():
            raise ValueError('Nome é obrigatório')
        if len(v.strip()) > 120:
            raise ValueError('Nome deve ter no máximo 120 caracteres')
        return v.strip()

class AdministradorCreate(AdministradorBase):
    """Modelo para criação de administrador"""
    pass

class AdministradorUpdate(AdministradorBase):
    """Modelo para atualização de administrador"""
    pass

class Administrador(AdministradorBase):
    """Modelo completo do administrador (com ID)"""
    administrador_id: int = Field(..., alias="ADMINISTRADORID", description="ID único do administrador")
    
    class Config:
        from_attributes = True
        populate_by_name = True

# Para compatibilidade com sistema Node.js
class AdministradorResponse(BaseModel):
    """Resposta compatível com o formato do Node.js"""
    AdministradorId: int
    Nome: str
    Chave: str
    Telefone: Optional[str] = None
    
    @classmethod
    def from_administrador(cls, administrador: Administrador):
        """Converte um Administrador para AdministradorResponse"""
        return cls(
            AdministradorId=administrador.administrador_id,
            Nome=administrador.nome,
            Chave=administrador.chave,
            Telefone=administrador.telefone
        )

class AdministradorSimple(BaseModel):
    """Modelo simplificado para listas"""
    administrador_id: int = Field(..., alias="ADMINISTRADORID")
    nome: str
    chave: str
    
    class Config:
        from_attributes = True
        populate_by_name = True