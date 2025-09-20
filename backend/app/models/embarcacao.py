#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelos para Embarcações
Baseado nas regras de negócio do sistema existente
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import date

class EmbarcacaoBase(BaseModel):
    """Modelo base para Embarcação"""
    Nome: str = Field(..., min_length=1, max_length=200, description="Nome da embarcação")
    PrimeiraEntradaPorto: Optional[date] = Field(None, description="Data da primeira entrada no porto")
    TipoEmbarcacao: Optional[str] = Field(None, max_length=20, description="Tipo da embarcação máximo 20 caracteres")

    @validator('Nome')
    def validate_nome(cls, v):
        """Nome é obrigatório"""
        if not v or not v.strip():
            raise ValueError('Nome da embarcação é obrigatório')
        return v.strip()

    @validator('TipoEmbarcacao')
    def validate_tipo(cls, v):
        """TipoEmbarcacao máximo 20 caracteres - REGRA DO sistema"""
        if v and len(str(v)) > 20:
            raise ValueError('Tipo da embarcação deve ter no máximo 20 caracteres')
        return str(v)[:20] if v else None

class EmbarcacaoCreate(EmbarcacaoBase):
    """Modelo para criação de embarcação"""
    pass

class EmbarcacaoUpdate(EmbarcacaoBase):
    """Modelo para atualização de embarcação"""
    pass

class Embarcacao(EmbarcacaoBase):
    """Modelo completo da embarcação (com ID)"""
    EmbarcacaoId: int = Field(..., description="ID único da embarcação")
    
    class Config:
        from_attributes = True
        populate_by_name = True

class EmbarcacaoSimple(BaseModel):
    """Modelo simplificado para listas"""
    EmbarcacaoId: int
    Nome: str
    TipoEmbarcacao: Optional[str] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True