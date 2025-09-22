#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelos Pydantic para Fiscal
Localização: backend/app/models/fiscal.py
"""

from pydantic import BaseModel, Field, validator
from typing import Optional

class FiscalBase(BaseModel):
    """Modelo base para Fiscal"""
    nome: str = Field(..., min_length=1, max_length=200, description="Nome completo do fiscal")
    chave: str = Field(..., min_length=4, max_length=4, description="Chave de 4 caracteres")
    telefone: Optional[str] = Field(None, max_length=15, description="Telefone de contato")

    @validator('chave')
    def validate_chave(cls, v):
        """Valida que a chave tem exatamente 4 caracteres"""
        if not v:
            raise ValueError('Chave é obrigatória')
        if len(v.strip()) != 4:
            raise ValueError('Chave deve ter exatamente 4 caracteres')
        return v.strip().upper()

    @validator('telefone')
    def validate_telefone(cls, v):
        """Valida o telefone"""
        if v and len(v) > 15:
            raise ValueError('Telefone deve ter no máximo 15 caracteres')
        return v.strip() if v else None

    @validator('nome')
    def validate_nome(cls, v):
        """Valida o nome"""
        if not v or not v.strip():
            raise ValueError('Nome é obrigatório')
        if len(v.strip()) > 200:
            raise ValueError('Nome deve ter no máximo 200 caracteres')
        return v.strip()

class FiscalCreate(FiscalBase):
    """Modelo para criação de fiscal"""
    pass

class FiscalUpdate(FiscalBase):
    """Modelo para atualização de fiscal"""
    pass

class Fiscal(FiscalBase):
    """Modelo completo do fiscal (com ID)"""
    fiscal_id: int = Field(..., alias="FiscalId", description="ID único do fiscal")
    
    class Config:
        from_attributes = True
        populate_by_name = True
        json_encoders = {
            # Pode adicionar encoders customizados aqui se necessário
        }

class FiscalSimple(BaseModel):
    """Modelo simplificado para listas"""
    fiscal_id: int = Field(..., alias="FiscalId")
    nome: str
    chave: str
    
    class Config:
        from_attributes = True
        populate_by_name = True

# Para compatibilidade com sistema Node.js
class FiscalResponse(BaseModel):
    """Resposta compatível com o formato do Node.js"""
    FiscalId: int
    Nome: str
    Chave: str
    Telefone: Optional[str] = None
    
    @classmethod
    def from_fiscal(cls, fiscal: Fiscal):
        """Converte um Fiscal para FiscalResponse"""
        return cls(
            FiscalId=fiscal.fiscal_id,
            Nome=fiscal.nome,
            Chave=fiscal.chave,
            Telefone=fiscal.telefone
        )