#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelos para Seção 4 - ROTINA (IAPO, SMS, Smart RDO)
Baseado no template completo da aplicação
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from enum import Enum

class StatusOSEnum(str, Enum):
    SIM = "SIM"
    NAO = "NAO"

class SimNaoEnum(str, Enum):
    SIM = "SIM"
    NAO = "NAO"

# 4.1 IAPO
class RotinaIAPO(BaseModel):
    passagem_id: int
    quinzena_encerrada_data1: Optional[date] = None  # 1º domingo
    quinzena_encerrada_oss1: StatusOSEnum = StatusOSEnum.NAO
    quinzena_encerrada_data2: Optional[date] = None  # 2º domingo  
    quinzena_encerrada_oss2: StatusOSEnum = StatusOSEnum.NAO
    para_quinzena_data3: Optional[date] = None       # 3º domingo
    para_quinzena_oss3: StatusOSEnum = StatusOSEnum.NAO
    observacoes: Optional[str] = None

# 4.2.1 SMS - LV Mangueiras
class SMSLVMangueiras(BaseModel):
    passagem_id: int
    data_ultima_lv: Optional[date] = None
    data_proxima_lv: Optional[date] = None  # calculada = última + 2 meses
    observacoes: Optional[str] = None

# 4.2.2 SMS - LV Segurança  
class SMSLVSeguranca(BaseModel):
    passagem_id: int
    farois_embarcacao_imagem: Optional[str] = None  # path para imagem
    farois_fiscal_imagem: Optional[str] = None      # path para imagem
    observacoes: Optional[str] = None

# 4.2.3 SMS - Auditoria Hora Segura
class SMSAuditoriaHoraSegura(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    data: date
    anexo: Optional[str] = None
    gerou_pendencia_broa: SimNaoEnum = SimNaoEnum.NAO

# 4.2.4 SMS - RAC QSMS
class SMSRACQSMS(BaseModel):
    passagem_id: int
    data: Optional[date] = None
    anexo: Optional[str] = None
    observacoes: Optional[str] = None

# 4.2.5 SMS - AIS
class SMSAIS(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nao_ocorreu_quinzena: bool = False
    data: Optional[date] = None
    descricao: Optional[str] = None
    prazo_envio: Optional[date] = None
    enviado: SimNaoEnum = SimNaoEnum.NAO
    link_form: Optional[str] = None
    anexo: Optional[str] = None
    observacoes: Optional[str] = None

# 4.2.6 SMS - Pendências BROA
class SMSPendenciasBROA(BaseModel):
    passagem_id: int
    pendencias_vencendo: SimNaoEnum = SimNaoEnum.NAO
    anexo_afretamento: Optional[str] = None
    anexo_servicos_tecnicos: Optional[str] = None

# 4.2.8 SMS - Alertas
class SMSAlertas(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    nao_ocorreu_quinzena: bool = False
    data: Optional[date] = None
    descricao: Optional[str] = None
    data_divulgacao: Optional[date] = None
    proxima_divulgacao: Optional[date] = None
    observacoes: Optional[str] = None

# 4.3 Smart RDO
class SmartRDO(BaseModel):
    passagem_id: int
    comandante: Optional[str] = None
    offshore_manager: Optional[str] = None
    cc: Optional[str] = None  # texto multilinha
    nenhuma_nova_orientacao: bool = False

class SmartRDOOrientacao(BaseModel):
    id: Optional[int] = None
    passagem_id: int
    data: date
    descricao: str
    anexo: Optional[str] = None
