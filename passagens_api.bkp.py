#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Passagens de Serviço - CORREÇÃO: USERNAME global → busca fiscal no BD → preenche "[chave] - [nome]"
Localização: backend/app/api/v1/passagens_api.py
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from pydantic import BaseModel, Field, validator
from datetime import date, datetime, timedelta
import logging
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/passagens", tags=["Passagens"])

# === MODELS ===
class PassagemCreate(BaseModel):
    NumeroPS: Optional[str] = None
    DataEmissao: Optional[date] = None  
    PeriodoInicio: date = Field(..., description="Início do período - obrigatório")
    PeriodoFim: date = Field(..., description="Fim do período - obrigatório")
    EmbarcacaoId: int = Field(..., description="ID da embarcação - obrigatório")
    FiscalEmbarcandoId: Optional[int] = None
    # REMOVIDO: FiscalDesembarcandoNome - agora usa USERNAME global → busca no BD

    @validator('PeriodoFim')
    def validate_periodo(cls, v, values):
        """Período fim deve ser >= período início"""
        if 'PeriodoInicio' in values and v < values['PeriodoInicio']:
            raise ValueError('Período fim deve ser maior ou igual ao início')
        return v

class PassagemUpdate(BaseModel):
    NumeroPS: Optional[str] = None
    DataEmissao: Optional[date] = None
    PeriodoInicio: date
    PeriodoFim: date  
    EmbarcacaoId: int
    FiscalEmbarcandoId: Optional[int] = None

class PassagemResponse(BaseModel):
    PassagemId: int
    NumeroPS: Optional[str] = None
    DataEmissao: Optional[str] = None
    PeriodoInicio: str
    PeriodoFim: str
    EmbarcacaoId: int
    EmbarcacaoNome: Optional[str] = None
    FiscalEmbarcandoId: Optional[int] = None
    FiscalEmbarcandoNome: Optional[str] = None
    FiscalDesembarcandoId: int
    FiscalDesembarcandoNome: Optional[str] = None
    FiscalDesembarcandoFormatado: Optional[str] = None  # NOVO: "[chave] - [nome]"
    Status: str
    OwnerUser: Optional[str] = None

# === BUSINESS LOGIC FUNCTIONS ===
async def get_current_fiscal_dados_bd():
    """
    NOVA FUNÇÃO: USERNAME global → busca dados completos do fiscal no BD
    Returns: dict com FiscalId, Nome, Chave, Telefone do banco de dados
    """
    from app.services.auth_service import (
        get_global_username,
        get_current_user_data
    )
    from app.config.database import db
    from app.config.settings import settings
    
    try:
        # 1. Verifica se USERNAME global está inicializado
        username = get_global_username()
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="USERNAME global não inicializado"
            )
        
        # 2. Busca dados do usuário usando USERNAME global
        user_data = await get_current_user_data()
        if not user_data or not user_data.get("fiscal_data"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Usuário '{username}' não está cadastrado como fiscal"
            )
        
        # 3. Extrai dados do fiscal do resultado
        fiscal_data = user_data["fiscal_data"]
        
        # 4. Monta dados formatados para retorno
        fiscal_formatado = f"[{fiscal_data['Chave']}] - {fiscal_data['Nome']}"
        
        return {
            "FiscalId": fiscal_data["FiscalId"],
            "Nome": fiscal_data["Nome"],
            "Chave": fiscal_data["Chave"],
            "Telefone": fiscal_data["Telefone"],
            "FiscalFormatado": fiscal_formatado  # "[chave] - [nome]"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao obter dados do fiscal via USERNAME global: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao obter dados do fiscal logado"
        )

def form_ps_num(numero):
    if not numero:
        return ''
    s = str(numero)
    if len(s) >= 4:
        # Adiciona barra antes dos 4 últimos: "192025" → "19/2025"
        return s[:-4] + '/' + s[-4:]
    

async def check_fiscal_rascunho_existente(fiscal_id: int):
    """REGRA DE NEGÓCIO: Fiscal desembarcando só pode ter 1 rascunho"""
    from app.config.database import db
    
    sql = "SELECT FIRST 1 PassagemId FROM PASSAGENS WHERE FiscalDesembarcandoId=? AND Status='RASCUNHO'"
    rows = await db.execute_query(sql, [fiscal_id])
    return len(rows) > 0

def can_edit_passagem(ps_data: dict, fiscal_id: int) -> bool:
    """FUNÇÃO DE NEGÓCIO CRÍTICA: Valida se pode editar PS"""
    try:
        status = ps_data.get('Status', ps_data.get('STATUS'))
        periodo_fim = ps_data.get('PeriodoFim', ps_data.get('PERIODOFIM'))
        fiscal_desemb_id = ps_data.get('FiscalDesembarcandoId', ps_data.get('FISCALDESEMBARCANDOID'))
        
        # Deve ser RASCUNHO
        if status != 'RASCUNHO':
            return False
        
        # Janela de tempo: até 1 dia após o fim do período
        if periodo_fim:
            if isinstance(periodo_fim, str):
                periodo_fim = datetime.strptime(periodo_fim, '%Y-%m-%d').date()
            
            limite = datetime.combine(periodo_fim, datetime.min.time()) + timedelta(days=1, hours=23, minutes=59, seconds=59)
            if datetime.now() > limite:
                return False
        
        # Deve ser o fiscal desembarcando
        if fiscal_desemb_id != fiscal_id:
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Erro em can_edit_passagem: {e}")
        return False

async def inicializar_secoes_porto(passagem_id: int):
    """REGRA DE NEGÓCIO: Inicializa seções PORTO automaticamente"""
    from app.config.database import db
    
    try:
        # 1.1 e 1.2 (linhas "singulares")
        await db.execute_query('INSERT INTO porto_trocaturma (PassagemId) VALUES (?)', [passagem_id])
        await db.execute_query('INSERT INTO porto_manutencaopreventiva (PassagemId, NaoSolicitada, NaoProgramada) VALUES (?,?,?)', 
                               [passagem_id, 0, 0])
        
        # 1.3–1.6 (com flag NaoPrevisto disponível)
        await db.execute_query('INSERT INTO porto_abastecimento (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        await db.execute_query('INSERT INTO porto_anvisa (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        await db.execute_query('INSERT INTO porto_classe (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        await db.execute_query('INSERT INTO porto_inspecoespetrobras (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        
        # 1.7–1.10 (listas) — cria "sentinela" NaoPrevisto=1
        await db.execute_query('INSERT INTO porto_embarqueequipes (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        await db.execute_query('INSERT INTO porto_embarquemateriais (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        await db.execute_query('INSERT INTO porto_desembarquemateriais (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        await db.execute_query('INSERT INTO porto_osmobilizacao (PassagemId, NaoPrevisto) VALUES (?,1)', [passagem_id])
        
        logger.info(f"Seções PORTO inicializadas para PS {passagem_id}")
        
    except Exception as e:
        logger.error(f"Erro ao inicializar seções PORTO para PS {passagem_id}: {e}")
        # Não falha a criação da PS por causa disso

async def log_audit_event(passagem_id: int, evento: str, descricao: str, fiscal_nome: str, fiscal_login: str, detalhe: Optional[str] = None):
    """FUNÇÃO DE AUDITORIA"""
    try:
        from app.config.database import db
        
        sql = "INSERT INTO AuditLog (PassagemId, Evento, Descricao, AutorUser, AutorNome, Detalhe) VALUES (?,?,?,?,?,?)"
        await db.execute_query(sql, [passagem_id, evento, descricao, fiscal_login, fiscal_nome, detalhe])
        
    except Exception as e:
        logger.error(f"Erro no log de auditoria: {e}")

# === API ENDPOINTS ===
@router.get("/", response_model=List[PassagemResponse])
async def list_passagens(inicio: Optional[str] = None, fim: Optional[str] = None):
    """Lista passagens do fiscal - USA USERNAME GLOBAL para identificar fiscal"""
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # CORREÇÃO: Query específica com campos ordenados
        sql = """
        SELECT p.PassagemId, p.NumeroPS, p.DataEmissao, p.PeriodoInicio, p.PeriodoFim,
               p.EmbarcacaoId, p.FiscalEmbarcandoId, p.FiscalDesembarcandoId, p.Status, p.OwnerUser,
               e.Nome AS EmbarcacaoNome, 
               fe.Nome AS FiscalEmbarcandoNome, 
               fd.Nome AS FiscalDesembarcandoNome,
               fd.Chave AS FiscalDesembarcandoChave
        FROM PASSAGENS p
        JOIN EMBARCACOES e ON e.EmbarcacaoId = p.EmbarcacaoId
        LEFT JOIN FISCAIS fe ON fe.FiscalId = p.FiscalEmbarcandoId
        JOIN FISCAIS fd ON fd.FiscalId = p.FiscalDesembarcandoId
        WHERE (p.FiscalEmbarcandoId = ? OR p.FiscalDesembarcandoId = ?)
        """
        
        params = [fiscal_id, fiscal_id]
        
        if inicio:
            sql += " AND p.PeriodoInicio >= ?"
            params.append(inicio)
            
        if fim:
            sql += " AND p.PeriodoFim <= ?"
            params.append(fim)
            
        sql += " ORDER BY p.PeriodoInicio DESC"
        
        rows = await db.execute_query(sql, params)
        
        passagens = []
        for row in rows:
            # Monta fiscal desembarcando formatado "[chave] - [nome]"
            fiscal_desemb_formatado = f"{row[13]}-{row[12]}" if row[13] and row[12] else row[12]
            
            passagens.append(PassagemResponse(
                PassagemId=row[0],          # p.PassagemId
                NumeroPS=form_ps_num(row[1]) if row[1] else None,  # p.NumeroPS
                DataEmissao=str(row[2]) if row[2] else None,       # p.DataEmissao
                PeriodoInicio=str(row[3]),  # p.PeriodoInicio
                PeriodoFim=str(row[4]),     # p.PeriodoFim
                EmbarcacaoId=row[5],        # p.EmbarcacaoId
                FiscalEmbarcandoId=row[6],  # p.FiscalEmbarcandoId
                FiscalDesembarcandoId=row[7], # p.FiscalDesembarcandoId
                Status=row[8],              # p.Status
                OwnerUser=row[9],           # p.OwnerUser
                EmbarcacaoNome=row[10],     # e.Nome
                FiscalEmbarcandoNome=row[11], # fe.Nome
                FiscalDesembarcandoNome=row[12], # fd.Nome
                FiscalDesembarcandoFormatado=fiscal_desemb_formatado # [chave] - [nome]
            ))
        
        logger.info(f"Listadas {len(passagens)} passagens para fiscal {fiscal_dados['Nome']} (USERNAME global)")
        return passagens
        
    except Exception as e:
        logger.error(f"Erro ao listar passagens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar passagens"
        )

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_passagem(passagem_data: PassagemCreate):
    """
    Cria nova PS - CORREÇÃO: USERNAME global → busca fiscal no BD → preenche automaticamente
    """
    try:
        from app.config.database import db
        
        # CORREÇÃO: USERNAME global → busca dados completos do fiscal no BD
        fiscal_dados = await get_current_fiscal_dados_bd()
        
        # REGRA DE NEGÓCIO: Fiscal desembarcando só pode ter 1 rascunho
        if await check_fiscal_rascunho_existente(fiscal_dados["FiscalId"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passagem de serviço já existe, no modo rascunho, para o fiscal!"
            )
        
        # Cria a PS com dados do fiscal obtidos do BD
        sql = """
        INSERT INTO PASSAGENS 
        (NumeroPS, DataEmissao, PeriodoInicio, PeriodoFim, EmbarcacaoId, FiscalEmbarcandoId, FiscalDesembarcandoId, Status, OwnerUser)
        VALUES (?,?,?,?,?,?,?,?,?)
        """
        
        params = [
            passagem_data.NumeroPS,
            passagem_data.DataEmissao, 
            passagem_data.PeriodoInicio,
            passagem_data.PeriodoFim,
            passagem_data.EmbarcacaoId,
            passagem_data.FiscalEmbarcandoId,
            fiscal_dados["FiscalId"],  # CORREÇÃO: Usa FiscalId do BD
            'RASCUNHO',
            fiscal_dados["Nome"]  # OwnerUser = Nome do BD
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected > 0:
            # Busca o ID da PS criada
            sql_id = """
            SELECT FIRST 1 PassagemId FROM PASSAGENS 
            WHERE FiscalDesembarcandoId = ? AND Status = 'RASCUNHO'
            ORDER BY PassagemId DESC
            """
            rows = await db.execute_query(sql_id, [fiscal_dados["FiscalId"]])
            
            if rows:
                passagem_id = rows[0][0]
                
                # REGRA DE NEGÓCIO: Inicializa seções PORTO
                await inicializar_secoes_porto(passagem_id)
                
                # AUDITORIA: Log do evento
                await log_audit_event(
                    passagem_id, 
                    'CREATE', 
                    'Criou a PS.',
                    fiscal_dados["Nome"],
                    fiscal_dados["Nome"]
                )
                
                logger.info(f"PS {passagem_id} criada para fiscal {fiscal_dados['FiscalFormatado']} (via USERNAME global)")
                
                # CORREÇÃO: Retorna também dados do fiscal formatado para o frontend
                return {
                    "PassagemId": passagem_id,
                    "FiscalDesembarcando": {
                        "FiscalId": fiscal_dados["FiscalId"],
                        "Nome": fiscal_dados["Nome"],
                        "Chave": fiscal_dados["Chave"],
                        "FiscalFormatado": fiscal_dados["FiscalFormatado"]  # "[chave] - [nome]"
                    }
                }
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar passagem de serviço"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar passagem: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar passagem de serviço"
        )

@router.get("/{passagem_id}", response_model=PassagemResponse)
async def get_passagem(passagem_id: int):
    """Busca PS por ID - USA USERNAME GLOBAL para validar permissão"""
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # CORREÇÃO: Query específica com campos ordenados
        sql = """
        SELECT p.PassagemId, p.NumeroPS, p.DataEmissao, p.PeriodoInicio, p.PeriodoFim,
               p.EmbarcacaoId, p.FiscalEmbarcandoId, p.FiscalDesembarcandoId, p.Status, p.OwnerUser,
               e.Nome AS EmbarcacaoNome, 
               fe.Nome AS FiscalEmbarcandoNome, 
               fd.Nome AS FiscalDesembarcandoNome,
               fd.Chave AS FiscalDesembarcandoChave
        FROM PASSAGENS p
        JOIN EMBARCACOES e ON e.EmbarcacaoId = p.EmbarcacaoId
        LEFT JOIN FISCAIS fe ON fe.FiscalId = p.FiscalEmbarcandoId
        JOIN FISCAIS fd ON fd.FiscalId = p.FiscalDesembarcandoId
        WHERE p.PassagemId=?
        """
        
        rows = await db.execute_query(sql, [passagem_id])
        
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        row = rows[0]
        
        # REGRA DE NEGÓCIO: Verifica permissão (só vê suas PS)
        fiscal_emb_id = row[6]  # FiscalEmbarcandoId
        fiscal_desemb_id = row[7]  # FiscalDesembarcandoId
        
        if fiscal_emb_id != fiscal_id and fiscal_desemb_id != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado"
            )
        
        # Monta fiscal desembarcando formatado "[chave] - [nome]"
        fiscal_desemb_formatado = f"{row[13]}-{row[12]}" if row[13] and row[12] else row[12]
        
        return PassagemResponse(
            PassagemId=row[0],          # p.PassagemId
            NumeroPS=form_ps_num(row[1]) if row[1] else None,  # p.NumeroPS
            DataEmissao=str(row[2]) if row[2] else None,       # p.DataEmissao
            PeriodoInicio=str(row[3]),  # p.PeriodoInicio
            PeriodoFim=str(row[4]),     # p.PeriodoFim
            EmbarcacaoId=row[5],        # p.EmbarcacaoId
            FiscalEmbarcandoId=row[6],  # p.FiscalEmbarcandoId
            FiscalDesembarcandoId=row[7], # p.FiscalDesembarcandoId
            Status=row[8],              # p.Status
            OwnerUser=row[9],           # p.OwnerUser
            EmbarcacaoNome=row[10],     # e.Nome
            FiscalEmbarcandoNome=row[11], # fe.Nome
            FiscalDesembarcandoNome=row[12], # fd.Nome
            FiscalDesembarcandoFormatado=fiscal_desemb_formatado # [chave] - [nome]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar passagem"
        )
@router.put("/{passagem_id}", response_model=PassagemResponse)
async def update_passagem(passagem_id: int, passagem_data: PassagemUpdate):
    """
    Atualiza dados básicos da PS - USA USERNAME GLOBAL para validar permissão
    """
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Busca PS para validar permissão
        sql_check = """
        SELECT Status, FiscalDesembarcandoId, PeriodoFim 
        FROM PASSAGENS WHERE PassagemId = ?
        """
        rows = await db.execute_query(sql_check, [passagem_id])
        
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        status_ps, fiscal_desemb_id, periodo_fim = rows[0]
        
        # REGRA DE NEGÓCIO: Só pode alterar se for RASCUNHO e fiscal desembarcando
        if status_ps != 'RASCUNHO':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Só é possível alterar PS em rascunho"
            )
        
        if fiscal_desemb_id != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Só o fiscal desembarcando pode alterar"
            )
        
        # Atualiza os campos básicos
        sql_update = """
        UPDATE PASSAGENS 
        SET DataEmissao = ?, PeriodoInicio = ?, PeriodoFim = ?, FiscalEmbarcandoId = ?
        WHERE PassagemId = ?
        """
        
        affected = await db.execute_query(sql_update, [
            passagem_data.DataEmissao,
            passagem_data.PeriodoInicio,
            passagem_data.PeriodoFim,
            passagem_data.FiscalEmbarcandoId,
            passagem_id
        ])
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar PS"
            )
        
        # AUDITORIA: Log do evento
        await log_audit_event(
            passagem_id, 
            'UPDATE', 
            'Atualizou dados básicos da PS.',
            fiscal_dados["Nome"],
            fiscal_dados["Nome"]
        )
        
        logger.info(f"PS {passagem_id} atualizada pelo fiscal {fiscal_dados['Nome']}")
        
        # Retorna PS atualizada
        return await get_passagem(passagem_id)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar passagem"
        )
    

@router.get("/{passagem_id}/porto")
async def get_porto_data(passagem_id: int):
    """
    GET /api/passagens/{id}/porto - Carrega dados das seções Porto 1.1 a 1.6
    """
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Valida se PS existe e fiscal tem permissão
        sql_check = """
        SELECT FiscalEmbarcandoId, FiscalDesembarcandoId 
        FROM PASSAGENS WHERE PassagemId = ?
        """
        rows_check = await db.execute_query(sql_check, [passagem_id])
        
        if not rows_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        fiscal_emb_id, fiscal_desemb_id = rows_check[0]
        if fiscal_emb_id != fiscal_id and fiscal_desemb_id != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado"
            )
        
        # Busca dados das 6 tabelas porto
        sql_queries = {
            'trocaturma': 'SELECT * FROM porto_trocaturma WHERE PassagemId=?',
            'manutencaopreventiva': 'SELECT * FROM porto_manutencaopreventiva WHERE PassagemId=?',
            'abastecimento': 'SELECT * FROM porto_abastecimento WHERE PassagemId=?',
            'anvisa': 'SELECT * FROM porto_anvisa WHERE PassagemId=?',
            'classe': 'SELECT * FROM porto_classe WHERE PassagemId=?',
            'inspecoespetrobras': 'SELECT * FROM porto_inspecoespetrobras WHERE PassagemId=?'
        }
        
        result = {}
        for table_key, sql in sql_queries.items():
            rows = await db.execute_query(sql, [passagem_id])
            if rows:
                # Converte row para dict usando column names
                columns = await db.get_column_names(sql, [passagem_id])
                row_dict = dict(zip(columns, rows[0])) if rows else None
                result[table_key] = row_dict
            else:
                result[table_key] = None
                
        # Ajusta nomes de chaves para compatibilidade com frontend
        if result.get('manutencaopreventiva'):
            result['manutencaoPreventiva'] = result.pop('manutencaopreventiva')
        if result.get('inspecoespetrobras'):
            result['inspecoesPetrobras'] = result.pop('inspecoespetrobras')
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar dados Porto PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar dados do Porto"
        )
    
@router.put("/{passagem_id}/porto")
async def update_porto_data(passagem_id: int, porto_data: dict):
    """
    PUT /api/passagens/{id}/porto - Salva dados das seções Porto 1.1 a 1.6
    """
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Valida PS e permissão de edição
        sql_check = """
        SELECT Status, FiscalDesembarcandoId, PeriodoFim,
               FiscalEmbarcandoId
        FROM PASSAGENS WHERE PassagemId = ?
        """
        rows_check = await db.execute_query(sql_check, [passagem_id])
        
        if not rows_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        ps_data = {
            'Status': rows_check[0][0],
            'FiscalDesembarcandoId': rows_check[0][1], 
            'PeriodoFim': rows_check[0][2],
            'FiscalEmbarcandoId': rows_check[0][3]
        }
        
        # Valida permissão de acesso
        if ps_data['FiscalEmbarcandoId'] != fiscal_id and ps_data['FiscalDesembarcandoId'] != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado"
            )
        
        # Valida permissão de edição
        if not can_edit_passagem(ps_data, fiscal_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Janela de edição encerrada ou você não é o desembarcante"
            )
        
        # Salva cada seção
        await salvar_trocaturma(db, passagem_id, porto_data.get('trocaturma', {}))
        await salvar_manutencao_preventiva(db, passagem_id, porto_data.get('manutencaoPreventiva', {}))
        await salvar_abastecimento(db, passagem_id, porto_data.get('abastecimento', {}))
        await salvar_anvisa(db, passagem_id, porto_data.get('anvisa', {}))
        await salvar_classe(db, passagem_id, porto_data.get('classe', {}))
        await salvar_inspecoes_petrobras(db, passagem_id, porto_data.get('inspecoesPetrobras', {}))
        
        # Log de auditoria
        await log_audit_event(
            passagem_id,
            'PORTO_SAVE',
            'Atualizou Seção Porto (1.1–1.6)',
            fiscal_dados["Nome"],
            fiscal_dados["Nome"]
        )
        
        logger.info(f"Dados Porto salvos para PS {passagem_id}")
        
        return {"success": True, "message": "Dados Porto salvos com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar dados Porto PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao salvar dados do Porto"
        )

# Funções auxiliares de salvamento
async def salvar_trocaturma(db, passagem_id: int, data: dict):
    """Salva seção 1.1 Troca de Turma"""
    sql = """
    UPDATE OR INSERT INTO porto_trocaturma 
    (PassagemId, Porto, Terminal, OrdemServico, AtracacaoHora, DuracaoMin, Observacoes)
    VALUES (?,?,?,?,?,?,?)
    MATCHING (PassagemId)
    """
    await db.execute_query(sql, [
        passagem_id,
        data.get('Porto'),
        data.get('Terminal'), 
        data.get('OrdemServico'),
        data.get('AtracacaoHora'),
        data.get('DuracaoMin'),
        data.get('Observacoes')
    ])

async def salvar_manutencao_preventiva(db, passagem_id: int, data: dict):
    """Salva seção 1.2 Manutenção Preventiva"""
    sql = """
    UPDATE OR INSERT INTO porto_manutencaopreventiva
    (PassagemId, NaoSolicitada, FranquiaSolicitadaMin, NaoProgramada, 
     OrdemServico, SaldoFranquiaMin, RADEPath, Observacoes)
    VALUES (?,?,?,?,?,?,?,?)
    MATCHING (PassagemId)
    """
    await db.execute_query(sql, [
        passagem_id,
        1 if data.get('NaoSolicitada') else 0,
        data.get('FranquiaSolicitadaMin'),
        1 if data.get('NaoProgramada') else 0,
        data.get('OrdemServico'),
        data.get('SaldoFranquiaMin'),
        data.get('RADEPath'),
        data.get('Observacoes')
    ])

async def salvar_abastecimento(db, passagem_id: int, data: dict):
    """Salva seção 1.3 Abastecimento"""
    sql = """
    UPDATE OR INSERT INTO porto_abastecimento
    (PassagemId, NaoPrevisto, OrdemServico, Quantidade_m3, DuracaoMin, Observacoes, AnexoPath)
    VALUES (?,?,?,?,?,?,?)
    MATCHING (PassagemId)
    """
    await db.execute_query(sql, [
        passagem_id,
        1 if data.get('NaoPrevisto') else 0,
        data.get('OrdemServico'),
        data.get('Quantidade_m3'),
        data.get('DuracaoMin'),
        data.get('Observacoes'),
        data.get('AnexoPath')
    ])

async def salvar_anvisa(db, passagem_id: int, data: dict):
    """Salva seção 1.4 ANVISA"""
    sql = """
    UPDATE OR INSERT INTO porto_anvisa
    (PassagemId, NaoPrevisto, OrdemServico, Descricao, Observacoes)
    VALUES (?,?,?,?,?)
    MATCHING (PassagemId)
    """
    await db.execute_query(sql, [
        passagem_id,
        1 if data.get('NaoPrevisto') else 0,
        data.get('OrdemServico'),
        data.get('Descricao'),
        data.get('Observacoes')
    ])

async def salvar_classe(db, passagem_id: int, data: dict):
    """Salva seção 1.5 Classe"""
    sql = """
    UPDATE OR INSERT INTO porto_classe
    (PassagemId, NaoPrevisto, OrdemServico, Descricao, Observacoes)
    VALUES (?,?,?,?,?)
    MATCHING (PassagemId)
    """
    await db.execute_query(sql, [
        passagem_id,
        1 if data.get('NaoPrevisto') else 0,
        data.get('OrdemServico'),
        data.get('Descricao'),
        data.get('Observacoes')
    ])

async def salvar_inspecoes_petrobras(db, passagem_id: int, data: dict):
    """Salva seção 1.6 Inspeções Petrobras"""
    sql = """
    UPDATE OR INSERT INTO porto_inspecoespetrobras
    (PassagemId, NaoPrevisto, Auditor, Gerencia, Observacoes)
    VALUES (?,?,?,?,?)
    MATCHING (PassagemId)
    """
    await db.execute_query(sql, [
        passagem_id,
        1 if data.get('NaoPrevisto') else 0,
        data.get('Auditor'),
        data.get('Gerencia'),
        data.get('Observacoes')
    ])


@router.get("/{passagem_id}/porto-listas")
async def get_porto_listas_data(passagem_id: int):
    """
    GET /api/passagens/{id}/porto-listas - Carrega dados das seções Porto 1.7 a 1.10 (listas)
    """
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Valida se PS existe e fiscal tem permissão
        sql_check = """
        SELECT FiscalEmbarcandoId, FiscalDesembarcandoId 
        FROM PASSAGENS WHERE PassagemId = ?
        """
        rows_check = await db.execute_query(sql_check, [passagem_id])
        
        if not rows_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        fiscal_emb_id, fiscal_desemb_id = rows_check[0]
        if fiscal_emb_id != fiscal_id and fiscal_desemb_id != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado"
            )
        
        # Busca dados das 4 tabelas de listas
        sql_equipes = """
        SELECT EmbEqId, NaoPrevisto, Tipo, Empresa, Nome, Observacoes 
        FROM porto_embarqueequipes 
        WHERE PassagemId=? ORDER BY EmbEqId
        """
        
        sql_embarque_materiais = """
        SELECT EmbMatId, NaoPrevisto, Origem, OS, Destino, RT, Observacoes, AnexoPath 
        FROM porto_embarquemateriais 
        WHERE PassagemId=? ORDER BY EmbMatId
        """
        
        sql_desembarque_materiais = """
        SELECT DesembMatId, NaoPrevisto, OS, Origem, Destino, RT, Observacoes, AnexoPath 
        FROM porto_desembarquemateriais 
        WHERE PassagemId=? ORDER BY DesembMatId
        """
        
        sql_os_mobilizacao = """
        SELECT OSMobId, NaoPrevisto, OS, Descricao, Observacoes, AnexoPath 
        FROM porto_osmobilizacao 
        WHERE PassagemId=? ORDER BY OSMobId
        """
        
        # Executa queries
        equipes_rows = await db.execute_query(sql_equipes, [passagem_id])
        embarque_rows = await db.execute_query(sql_embarque_materiais, [passagem_id])
        desembarque_rows = await db.execute_query(sql_desembarque_materiais, [passagem_id])
        osmob_rows = await db.execute_query(sql_os_mobilizacao, [passagem_id])
        
        # Processa listas usando função pack_list
        def pack_list(rows, field_names):
            if not rows:
                return {"naoPrevisto": True, "linhas": []}
            
            # Verifica se todas as linhas são "sentinela" (NaoPrevisto=1 e campos vazios)
            nao_previsto = all(
                row[1] == 1 and all(row[i] is None or row[i] == '' for i in range(2, len(row)))
                for row in rows
            )
            
            if nao_previsto:
                return {"naoPrevisto": True, "linhas": []}
            
            # Filtra linhas reais (NaoPrevisto != 1) e converte para dict
            linhas = []
            for row in rows:
                if row[1] != 1:  # Se não é sentinela
                    linha_dict = {}
                    for i, field_name in enumerate(field_names):
                        linha_dict[field_name] = row[i + 2] if i + 2 < len(row) else None
                    linhas.append(linha_dict)
            
            return {"naoPrevisto": False, "linhas": linhas}
        
        # Monta resposta
        result = {
            "equipes": pack_list(equipes_rows, ['Tipo', 'Empresa', 'Nome', 'Observacoes']),
            "embarqueMateriais": pack_list(embarque_rows, ['Origem', 'OS', 'Destino', 'RT', 'Observacoes', 'AnexoPath']),
            "desembarqueMateriais": pack_list(desembarque_rows, ['OS', 'Origem', 'Destino', 'RT', 'Observacoes', 'AnexoPath']),
            "osMobilizacao": pack_list(osmob_rows, ['OS', 'Descricao', 'Observacoes', 'AnexoPath'])
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar listas Porto PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar listas do Porto"
        )
    
@router.put("/{passagem_id}/porto-listas")
async def update_porto_listas_data(passagem_id: int, listas_data: dict):
    """
    PUT /api/passagens/{id}/porto-listas - Salva dados das seções Porto 1.7 a 1.10 (listas)
    """
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Valida PS e permissão de edição
        sql_check = """
        SELECT Status, FiscalDesembarcandoId, PeriodoFim,
               FiscalEmbarcandoId
        FROM PASSAGENS WHERE PassagemId = ?
        """
        rows_check = await db.execute_query(sql_check, [passagem_id])
        
        if not rows_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        ps_data = {
            'Status': rows_check[0][0],
            'FiscalDesembarcandoId': rows_check[0][1], 
            'PeriodoFim': rows_check[0][2],
            'FiscalEmbarcandoId': rows_check[0][3]
        }
        
        # Valida permissão de acesso
        if ps_data['FiscalEmbarcandoId'] != fiscal_id and ps_data['FiscalDesembarcandoId'] != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado"
            )
        
        # Valida permissão de edição
        if not can_edit_passagem(ps_data, fiscal_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Janela de edição encerrada ou você não é o desembarcante"
            )
        
        # Salva cada lista
        await salvar_lista_equipes(db, passagem_id, listas_data.get('equipes', {}))
        await salvar_lista_embarque_materiais(db, passagem_id, listas_data.get('embarqueMateriais', {}))
        await salvar_lista_desembarque_materiais(db, passagem_id, listas_data.get('desembarqueMateriais', {}))
        await salvar_lista_os_mobilizacao(db, passagem_id, listas_data.get('osMobilizacao', {}))
        
        # Log de auditoria
        await log_audit_event(
            passagem_id,
            'PORTO_LISTAS_SAVE',
            'Atualizou Listas Porto (1.7–1.10)',
            fiscal_dados["Nome"],
            fiscal_dados["Nome"]
        )
        
        logger.info(f"Listas Porto salvas para PS {passagem_id}")
        
        return {"success": True, "message": "Listas Porto salvas com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao salvar listas Porto PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao salvar listas do Porto"
        )

# Funções auxiliares para salvar listas
async def salvar_lista_equipes(db, passagem_id: int, data: dict):
    """Salva seção 1.7 Embarque de Equipes"""
    table_name = "porto_embarqueequipes"
    await salvar_lista_generica(db, table_name, passagem_id, data, 
                               ['Tipo', 'Empresa', 'Nome', 'Observacoes'])

async def salvar_lista_embarque_materiais(db, passagem_id: int, data: dict):
    """Salva seção 1.8 Embarque de Materiais"""
    table_name = "porto_embarquemateriais"
    await salvar_lista_generica(db, table_name, passagem_id, data,
                               ['Origem', 'OS', 'Destino', 'RT', 'Observacoes', 'AnexoPath'])

async def salvar_lista_desembarque_materiais(db, passagem_id: int, data: dict):
    """Salva seção 1.9 Desembarque de Materiais"""
    table_name = "porto_desembarquemateriais"
    await salvar_lista_generica(db, table_name, passagem_id, data,
                               ['OS', 'Origem', 'Destino', 'RT', 'Observacoes', 'AnexoPath'])

async def salvar_lista_os_mobilizacao(db, passagem_id: int, data: dict):
    """Salva seção 1.10 OS Mobilização/Desmobilização"""
    table_name = "porto_osmobilizacao"
    await salvar_lista_generica(db, table_name, passagem_id, data,
                               ['OS', 'Descricao', 'Observacoes', 'AnexoPath'])

async def salvar_lista_generica(db, table_name: str, passagem_id: int, data: dict, fields: list):
    """Função genérica para salvar listas porto"""
    # Limpa registros existentes
    await db.execute_query(f"DELETE FROM {table_name} WHERE PassagemId=?", [passagem_id])
    
    # Se naoPrevisto=True, insere apenas sentinela
    if data.get('naoPrevisto', False):
        await db.execute_query(
            f"INSERT INTO {table_name} (PassagemId, NaoPrevisto) VALUES (?,1)",
            [passagem_id]
        )
        return
    
    # Insere linhas reais
    linhas = data.get('linhas', [])
    if not linhas:
        # Se não há linhas, cria sentinela
        await db.execute_query(
            f"INSERT INTO {table_name} (PassagemId, NaoPrevisto) VALUES (?,1)",
            [passagem_id]
        )
        return
    
    # Monta SQL de inserção dinamicamente
    field_placeholders = ','.join(['?'] * (len(fields) + 2))  # +2 para PassagemId e NaoPrevisto
    all_fields = ['PassagemId', 'NaoPrevisto'] + fields
    fields_str = ','.join(all_fields)
    
    sql = f"INSERT INTO {table_name} ({fields_str}) VALUES ({field_placeholders})"
    
    # Insere cada linha
    for linha in linhas:
        values = [passagem_id, 0]  # PassagemId, NaoPrevisto=0
        for field in fields:
            values.append(linha.get(field))
        
        await db.execute_query(sql, values)

from fastapi import UploadFile, File
import os
from pathlib import Path

@router.post("/{passagem_id}/upload")
async def upload_anexo(passagem_id: int, file: UploadFile = File(...)):
    """
    POST /api/passagens/{id}/upload - Upload de anexos para seção Porto
    """
    try:
        from app.config.database import db
        from app.config.settings import settings
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Valida se PS existe e fiscal tem permissão
        sql_check = """
        SELECT FiscalEmbarcandoId, FiscalDesembarcandoId 
        FROM PASSAGENS WHERE PassagemId = ?
        """
        rows_check = await db.execute_query(sql_check, [passagem_id])
        
        if not rows_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        fiscal_emb_id, fiscal_desemb_id = rows_check[0]
        if fiscal_emb_id != fiscal_id and fiscal_desemb_id != fiscal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado"
            )
        
        # Cria diretório da PS se não existir
        storage_dir = Path(settings.STORAGE_DIR) / "PS" / str(passagem_id)
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Sanitiza nome do arquivo
        safe_filename = file.filename.replace("/", "_").replace("\\", "_").replace(":", "_")
        safe_filename = safe_filename.replace("*", "_").replace("?", "_").replace('"', "_")
        safe_filename = safe_filename.replace("<", "_").replace(">", "_").replace("|", "_")
        
        # Adiciona timestamp para evitar conflitos
        timestamp = int(time.time())
        filename = f"{timestamp}_{safe_filename}"
        
        # Caminho completo do arquivo
        file_path = storage_dir / filename
        
        # Salva arquivo
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Log de auditoria
        await log_audit_event(
            passagem_id,
            'UPLOAD',
            f'Upload de arquivo ({file.filename})',
            fiscal_dados["Nome"],
            fiscal_dados["Nome"],
            str(file_path)
        )
        
        logger.info(f"Arquivo {file.filename} salvo para PS {passagem_id}")
        
        return {
            "ok": True,
            "path": str(file_path),
            "filename": filename,
            "original_filename": file.filename,
            "size": len(content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no upload para PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro no upload do arquivo"
        )

    
@router.delete("/{passagem_id}")
async def delete_passagem(passagem_id: int):
    """Exclui uma passagem de serviço"""
    try:
        from app.config.database import db
        
        # Obtém dados do fiscal via USERNAME global
        fiscal_dados = await get_current_fiscal_dados_bd()
        fiscal_id = fiscal_dados["FiscalId"]
        
        # Busca PS para validar permissão
        sql_check = "SELECT Status, FiscalDesembarcandoId FROM PASSAGENS WHERE PassagemId = ?"
        rows = await db.execute_query(sql_check, [passagem_id])
        
        if not rows:
            raise HTTPException(status_code=404, detail="PS não encontrada")
        
        status, fiscal_desemb_id = rows[0]
        
        # Só pode excluir RASCUNHO e se for o fiscal desembarcando
        if status != 'RASCUNHO':
            raise HTTPException(status_code=403, detail="Só é possível excluir PS em rascunho")
        
        if fiscal_desemb_id != fiscal_id:
            raise HTTPException(status_code=403, detail="Só o fiscal desembarcando pode excluir")
        
        # Exclui a PS
        await db.execute_query("DELETE FROM porto_trocaturma WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_manutencaopreventiva WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_abastecimento WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_anvisa WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_classe WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_inspecoespetrobras WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_embarqueequipes WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_embarquemateriais WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_desembarquemateriais WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM porto_osmobilizacao WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM AUDITLOG WHERE PassagemId = ?", [passagem_id])
        await db.execute_query("DELETE FROM PASSAGENS WHERE PassagemId = ?", [passagem_id])
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir PS {passagem_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao excluir PS")