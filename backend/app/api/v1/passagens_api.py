#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Passagens de Serviço - TODA a lógica complexa do server.js
Inclui validações, regras de negócio, permissões e inicialização PORTO
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from pydantic import BaseModel, Field, validator
from datetime import date, datetime, timedelta
import logging

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
    FiscalDesembarcandoNome: str = Field(..., description="Nome do fiscal desembarcando - obrigatório")

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
    Status: str
    OwnerUser: Optional[str] = None

# === BUSINESS LOGIC FUNCTIONS ===
async def resolve_fiscal_by_name(nome: str):
    """Resolve fiscal por nome - MESMA FUNÇÃO DO server.js"""
    from app.config.database import db
    
    sql = "SELECT FIRST 1 FiscalId, Nome, Chave, Telefone FROM FISCAIS WHERE UPPER(Nome) = UPPER(?)"
    rows = await db.execute_query(sql, [nome.strip()])
    
    if rows:
        row = rows[0]
        return {
            "FiscalId": row[0],
            "Nome": row[1],
            "Chave": row[2],
            "Telefone": row[3]
        }
    return None

async def check_fiscal_rascunho_existente(fiscal_id: int):
    """REGRA DE NEGÓCIO: Fiscal desembarcando só pode ter 1 rascunho"""
    from app.config.database import db
    
    sql = "SELECT FIRST 1 PassagemId FROM PASSAGENS WHERE FiscalDesembarcandoId=? AND Status='RASCUNHO'"
    rows = await db.execute_query(sql, [fiscal_id])
    return len(rows) > 0

def can_edit_passagem(ps_data: dict, fiscal_id: int) -> bool:
    """FUNÇÃO DE NEGÓCIO CRÍTICA: Valida se pode editar PS - EXATA DO server.js"""
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
    """REGRA DE NEGÓCIO: Inicializa seções PORTO automaticamente - EXATA DO server.js"""
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
    """FUNÇÃO DE AUDITORIA - EXATA DO server.js"""
    try:
        from app.config.database import db
        
        sql = "INSERT INTO AuditLog (PassagemId, Evento, Descricao, AutorUser, AutorNome, Detalhe) VALUES (?,?,?,?,?,?)"
        await db.execute_query(sql, [passagem_id, evento, descricao, fiscal_login, fiscal_nome, detalhe])
        
    except Exception as e:
        logger.error(f"Erro no log de auditoria: {e}")

# === API ENDPOINTS ===
@router.get("/", response_model=List[PassagemResponse])
async def list_passagens(inicio: Optional[str] = None, fim: Optional[str] = None, fiscal_id: int = 1):
    """Lista passagens do fiscal - MESMA LÓGICA DO server.js"""
    try:
        from app.config.database import db
        
        # Query complexa igual ao server.js
        sql = """
        SELECT p.*, 
               e.Nome AS "EmbarcacaoNome", 
               fe.Nome AS "FiscalEmbarcandoNome", 
               fd.Nome AS "FiscalDesembarcandoNome"
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
            passagens.append(PassagemResponse(
                PassagemId=row[0],
                NumeroPS=row[1],
                DataEmissao=str(row[2]) if row[2] else None,
                PeriodoInicio=str(row[3]),
                PeriodoFim=str(row[4]),
                EmbarcacaoId=row[5],
                FiscalEmbarcandoId=row[6],
                FiscalDesembarcandoId=row[7],
                Status=row[8],
                OwnerUser=row[9],
                EmbarcacaoNome=row[10],
                FiscalEmbarcandoNome=row[11],
                FiscalDesembarcandoNome=row[12]
            ))
        
        logger.info(f"Listadas {len(passagens)} passagens para fiscal {fiscal_id}")
        return passagens
        
    except Exception as e:
        logger.error(f"Erro ao listar passagens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar passagens"
        )

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_passagem(passagem_data: PassagemCreate):
    """Cria nova PS - TODA A LÓGICA COMPLEXA DO server.js"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Resolve fiscal desembarcando
        fiscal_desemb = await resolve_fiscal_by_name(passagem_data.FiscalDesembarcandoNome)
        if not fiscal_desemb:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fiscal não cadastrado - Desembarque"
            )
        
        # REGRA DE NEGÓCIO: Fiscal desembarcando só pode ter 1 rascunho
        if await check_fiscal_rascunho_existente(fiscal_desemb["FiscalId"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passagem de serviço já existe, no modo rascunho, para o fiscal!"
            )
        
        # Cria a PS
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
            fiscal_desemb["FiscalId"],
            'RASCUNHO',
            fiscal_desemb["Nome"]  # OwnerUser
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected > 0:
            # Busca o ID da PS criada
            sql_id = """
            SELECT FIRST 1 PassagemId FROM PASSAGENS 
            WHERE FiscalDesembarcandoId = ? AND Status = 'RASCUNHO'
            ORDER BY PassagemId DESC
            """
            rows = await db.execute_query(sql_id, [fiscal_desemb["FiscalId"]])
            
            if rows:
                passagem_id = rows[0][0]
                
                # REGRA DE NEGÓCIO: Inicializa seções PORTO
                await inicializar_secoes_porto(passagem_id)
                
                # AUDITORIA: Log do evento
                await log_audit_event(
                    passagem_id, 
                    'CREATE', 
                    'Criou a PS.',
                    fiscal_desemb["Nome"],
                    fiscal_desemb["Nome"]
                )
                
                logger.info(f"PS {passagem_id} criada para fiscal {fiscal_desemb['Nome']}")
                return {"PassagemId": passagem_id}
        
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
async def get_passagem(passagem_id: int, fiscal_id: int = 1):
    """Busca PS por ID - MESMA LÓGICA DO server.js"""
    try:
        from app.config.database import db
        
        sql = """
        SELECT FIRST 1 p.*, e.Nome AS "EmbarcacaoNome", fe.Nome AS "FiscalEmbarcandoNome", fd.Nome AS "FiscalDesembarcandoNome"
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
        
        return PassagemResponse(
            PassagemId=row[0],
            NumeroPS=row[1],
            DataEmissao=str(row[2]) if row[2] else None,
            PeriodoInicio=str(row[3]),
            PeriodoFim=str(row[4]),
            EmbarcacaoId=row[5],
            FiscalEmbarcandoId=row[6],
            FiscalDesembarcandoId=row[7],
            Status=row[8],
            OwnerUser=row[9],
            EmbarcacaoNome=row[10],
            FiscalEmbarcandoNome=row[11],
            FiscalDesembarcandoNome=row[12]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar passagem"
        )

@router.put("/{passagem_id}", response_model=dict)
async def update_passagem(passagem_id: int, passagem_data: PassagemUpdate, fiscal_id: int = 1):
    """Atualiza PS - TODAS AS VALIDAÇÕES DO server.js"""
    try:
        from app.config.database import db
        
        # Busca PS atual
        sql_current = "SELECT FIRST 1 * FROM PASSAGENS WHERE PassagemId=?"
        rows = await db.execute_query(sql_current, [passagem_id])
        
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
        ps_current = {
            'PassagemId': rows[0][0],
            'Status': rows[0][8],
            'PeriodoFim': rows[0][4],
            'FiscalDesembarcandoId': rows[0][7]
        }
        
        # REGRA DE NEGÓCIO: Valida permissão/janela de edição
        if not can_edit_passagem(ps_current, fiscal_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Janela de edição encerrada ou não está desembarcando."
            )
        
        # Atualiza PS
        sql_update = """
        UPDATE PASSAGENS SET
        NumeroPS=?, DataEmissao=?, PeriodoInicio=?, PeriodoFim=?, EmbarcacaoId=?, FiscalEmbarcandoId=?
        WHERE PassagemId=?
        """
        
        params = [
            passagem_data.NumeroPS,
            passagem_data.DataEmissao,
            passagem_data.PeriodoInicio,
            passagem_data.PeriodoFim,
            passagem_data.EmbarcacaoId,
            passagem_data.FiscalEmbarcandoId,
            passagem_id
        ]
        
        affected = await db.execute_query(sql_update, params)
        
        if affected > 0:
            # AUDITORIA: Log da atualização
            await log_audit_event(
                passagem_id,
                'UPDATE',
                'Atualizou Cabeçalho.',
                'Sistema',  # TODO: pegar do contexto
                'Sistema'
            )
            
            logger.info(f"PS {passagem_id} atualizada")
            return {"ok": True}
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PS não encontrada"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar PS {passagem_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar passagem"
        )
