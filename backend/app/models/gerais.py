#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelos para Seção 7 - INFORMAÇÕES GERAIS
Baseado no template completo da aplicação  
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from enum import Enum

class TipoDispositivoEnum(str, Enum):
    NOTEBOOK = "Notebook"
    DESKTOP = "Desktop"

class ResponsavelEnum(str, Enum):
    MIS = "MIS"
    CRD = "CRD" 
    EQSE = "EQSE"
    OUTROS = "OUTROS"

class SimNaoEnum(str, Enum):
    SIM = "SIM"
    NAO = "NAO"

# 7.1 Gerência de Contrato e Suporte Técnico
class GerenciaContrato(BaseModel):
    passagem_id: int
    # Gerente de Contrato
    gerente_nome: Optional[str] = None
    gerente_chave: Optional[str] = None
    gerente_telefone: Optional[str] = None
    # Fiscal Administrativo
    fiscal_adm_nome: Optional[str] = None
    fiscal_adm_chave: Optional[str] = None
    fiscal_adm_telefone: Optional[str] = None
    # ATO
    ato_nome: Optional[str] = None
    ato_chave: Optional[str] = None
    ato_empresa: Optional[str] = None
    ato_telefone: Optional[str] = None
    # STO Petrobras
    sto_nome: Optional[str] = None
    sto_chave: Optional[str] = None
    sto_telefone: Optional[str] = None
    # Outras Informações
    outras_informacoes: Optional[str] = None

# 7.2 Dados das Contratadas
class DadosContratadas(BaseModel):
    passagem_id: int
    # Contratada Serviços Técnicos
    contratada_servicos: Optional[str] = None
    preposto_servicos_nome: Optional[str] = None
    preposto_servicos_telefone: Optional[str] = None
    preposto_servicos_email: Optional[str] = None
    sto_servicos_nome: Optional[str] = None
    sto_servicos_telefone: Optional[str] = None
    sto_servicos_email: Optional[str] = None
    # Contratada Afretamento
    contratada_afretamento: Optional[str] = None
    preposto_afret_nome: Optional[str] = None
    preposto_afret_telefone: Optional[str] = None
    preposto_afret_email: Optional[str] = None
    # Outras Informações
    outras_informacoes: Optional[str] = None

# 7.3 Materiais e Equipamentos a Bordo
class MateriaisEquipamentos(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nao_ha_materiais: bool = False
    ordem_servico: Optional[str] = None
    descricao: Optional[str] = None
    responsavel: Optional[ResponsavelEnum] = None
    numero_serie: Optional[str] = None
    data_embarque: Optional[date] = None
    observacoes: Optional[str] = None

# 7.4.1 Telefones e Ramais
class TelefonesRamais(BaseModel):
    passagem_id: int
    # Sala Fiscalização
    fiscal_ramal_petrobras: Optional[str] = None
    fiscal_rota: Optional[str] = None
    fiscal_ramal_interno: Optional[str] = None
    fiscal_telefone_externo: Optional[str] = None
    # Sala de Operações
    operacoes_ramal_petrobras: Optional[str] = None
    operacoes_rota: Optional[str] = None
    operacoes_ramal_interno: Optional[str] = None
    operacoes_telefone_externo: Optional[str] = None
    operacoes_celular: Optional[str] = None
    # Camarote Fiscal
    camarote_ramal_petrobras: Optional[str] = None
    camarote_rota: Optional[str] = None
    camarote_ramal_interno: Optional[str] = None
    camarote_telefone_externo: Optional[str] = None
    # Passadiço
    passadico_ramal_petrobras: Optional[str] = None
    passadico_rota: Optional[str] = None
    passadico_ramal_interno: Optional[str] = None
    passadico_telefone_externo: Optional[str] = None
    passadico_celular: Optional[str] = None
    passadico_inmarsat: Optional[str] = None
    # Outros
    enfermaria: Optional[str] = None
    rov: Optional[str] = None
    praca_maquinas: Optional[str] = None
    cozinha: Optional[str] = None
    comandante_ramal: Optional[str] = None
    comandante_telefone: Optional[str] = None

# 7.4.3 Computadores Homologados
class ComputadoresHomologados(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    tipo: TipoDispositivoEnum
    numero_tic: Optional[str] = None
    data_ultimo_login: Optional[date] = None
    realizar_login_ate: Optional[date] = None
    observacoes: Optional[str] = None

# 7.4.4 Senhas de Acesso
class SenhasAcesso(BaseModel):
    passagem_id: int
    # WIFI
    wifi_ssid: Optional[str] = None
    wifi_senha: Optional[str] = None
    # PC Desktop
    pc_usuario: Optional[str] = None
    pc_senha: Optional[str] = None
    # CFTV
    cftv_funcional: SimNaoEnum = SimNaoEnum.NAO
    cftv_login: Optional[str] = None
    cftv_senha: Optional[str] = None
    # Observações
    observacoes: Optional[str] = None

# 7.4.5 Acomodações
class Acomodacoes(BaseModel):
    passagem_id: int
    descricao: Optional[str] = None
