#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelos para Seção 6 - ORDENS DE SERVIÇO
Baseado no template completo da aplicação
"""

from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ProtocoloAproximacaoEnum(str, Enum):
    NAO_APLICAVEL = "NÃO APLICÁVEL"
    REVALIDAR = "REVALIDAR"
    EMITIR = "EMITIR"

# 6.1 OS Previstas com Orientações Específicas
class OSPrevista(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nenhuma_os_especifica: bool = False
    ordem_servico: Optional[str] = None
    descricao: Optional[str] = None
    protocolo_aproximacao: Optional[ProtocoloAproximacaoEnum] = None
    observacoes: Optional[str] = None

# 6.2 OS Interrompidas  
class OSInterrompida(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nenhuma_os_interrompida: bool = False
    ordem_servico: Optional[str] = None
    descricao: Optional[str] = None
    protocolo_aproximacao: Optional[ProtocoloAproximacaoEnum] = None
    observacoes: Optional[str] = None
    relatorio: Optional[str] = None

# 6.3 Anotações e Observações Gerais
class OSAnotacoesGerais(BaseModel):
    passagem_id: int
    anotacoes_observacoes: Optional[str] = None  # campo texto multilinha
