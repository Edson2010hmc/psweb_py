#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Fiscais - TODAS as regras de negócio e validações
Baseado no server.js linha por linha
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from pydantic import BaseModel, Field, validator
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fiscais", tags=["Fiscais"])

# === MODELS ===
class FiscalCreate(BaseModel):
    Nome: str = Field(..., min_length=1, max_length=200, description="Nome completo do fiscal")
    Chave: str = Field(..., min_length=4, max_length=4, description="Chave de EXATAMENTE 4 caracteres")
    Telefone: Optional[str] = Field(None, max_length=15, description="Telefone máximo 15 caracteres")

    @validator('Chave')
    def validate_chave(cls, v):
        """Chave deve ter EXATAMENTE 4 caracteres"""
        if not v or len(v.strip()) != 4:
            raise ValueError('Chave deve ter exatamente 4 caracteres')
        return v.strip().upper()

    @validator('Nome')
    def validate_nome(cls, v):
        """Nome é obrigatório"""
        if not v or not v.strip():
            raise ValueError('Nome é obrigatório')
        return v.strip()

    @validator('Telefone')
    def validate_telefone(cls, v):
        """Telefone máximo 15 caracteres"""
        if v and len(str(v)) > 15:
            raise ValueError('Telefone deve ter no máximo 15 caracteres')
        return str(v)[:15] if v else ""

class FiscalUpdate(BaseModel):
    Nome: str = Field(..., min_length=1, max_length=200)
    Chave: str = Field(..., min_length=4, max_length=4)
    Telefone: Optional[str] = Field(None, max_length=15)

    @validator('Chave')
    def validate_chave(cls, v):
        if not v or len(v.strip()) != 4:
            raise ValueError('Chave deve ter exatamente 4 caracteres')
        return v.strip().upper()

    @validator('Nome')
    def validate_nome(cls, v):
        if not v or not v.strip():
            raise ValueError('Nome é obrigatório')
        return v.strip()

    @validator('Telefone')
    def validate_telefone(cls, v):
        if v and len(str(v)) > 15:
            raise ValueError('Telefone deve ter no máximo 15 caracteres')
        return str(v)[:15] if v else ""

class FiscalResponse(BaseModel):
    FiscalId: int
    Nome: str
    Chave: str
    Telefone: Optional[str] = None

# === BUSINESS LOGIC FUNCTIONS ===
async def check_fiscal_duplicates(nome: str, chave: str, exclude_id: Optional[int] = None):
    """Verifica duplicatas de Nome ou Chave - REGRA DE NEGÓCIO"""
    from app.config.database import db
    
    # Busca duplicatas
    sql = "SELECT FIRST 1 FiscalId FROM FISCAIS WHERE (UPPER(Nome) = UPPER(?) OR UPPER(Chave) = UPPER(?))"
    params = [nome.strip(), chave.strip()]
    
    if exclude_id:
        sql += " AND FiscalId <> ?"
        params.append(exclude_id)
    
    rows = await db.execute_query(sql, params)
    return len(rows) > 0

async def check_fiscal_ps_vinculos(fiscal_id: int):
    """Verifica se fiscal tem PS vinculadas - REGRA DE NEGÓCIO"""
    from app.config.database import db
    
    sql = """
    SELECT FIRST 1 PassagemId 
    FROM PASSAGENS 
    WHERE FiscalEmbarcandoId = ? OR FiscalDesembarcandoId = ?
    """
    rows = await db.execute_query(sql, [fiscal_id, fiscal_id])
    return len(rows) > 0

async def resolve_fiscal_by_name(nome: str):
    """Resolve fiscal por nome completo - FUNÇÃO DE NEGÓCIO"""
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

# === API ENDPOINTS ===
@router.get("/", response_model=List[FiscalResponse])
async def list_fiscais():
    """Lista todos os fiscais - MESMA LÓGICA DO server.js"""
    try:
        from app.config.database import db
        
        sql = "SELECT FiscalId, Nome, Chave, Telefone FROM FISCAIS ORDER BY Nome"
        rows = await db.execute_query(sql)
        
        fiscais = []
        for row in rows:
            fiscais.append(FiscalResponse(
                FiscalId=row[0],
                Nome=row[1],
                Chave=row[2], 
                Telefone=row[3]
            ))
        
        logger.info(f"Listados {len(fiscais)} fiscais")
        return fiscais
        
    except Exception as e:
        logger.error(f"Erro ao listar fiscais: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar fiscais"
        )

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_fiscal(fiscal_data: FiscalCreate):
    """Cria novo fiscal - TODAS AS VALIDAÇÕES DO server.js"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica duplicatas
        if await check_fiscal_duplicates(fiscal_data.Nome, fiscal_data.Chave):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ja cadastrado"  # Mesma mensagem do server.js
            )
        
        # Insere no banco
        sql = "INSERT INTO FISCAIS (Nome, Chave, Telefone) VALUES (?,?,?)"
        params = [
            fiscal_data.Nome,
            fiscal_data.Chave,
            fiscal_data.Telefone or ""
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected > 0:
            # Busca o fiscal criado para retornar
            novo_fiscal = await resolve_fiscal_by_name(fiscal_data.Nome)
            logger.info(f"Fiscal criado: {fiscal_data.Nome}")
            return {"ok": True, "FiscalId": novo_fiscal["FiscalId"]}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar fiscal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao salvar"
        )

@router.put("/{fiscal_id}", response_model=FiscalResponse)
async def update_fiscal(fiscal_id: int, fiscal_data: FiscalUpdate):
    """Atualiza fiscal - TODAS AS VALIDAÇÕES DO server.js"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica duplicatas (excluindo o próprio)
        if await check_fiscal_duplicates(fiscal_data.Nome, fiscal_data.Chave, fiscal_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Chave já utilizada por outro fiscal"
            )
        
        # Atualiza no banco
        sql = "UPDATE FISCAIS SET Nome=?, Chave=?, Telefone=? WHERE FiscalId=?"
        params = [
            fiscal_data.Nome,
            fiscal_data.Chave,
            fiscal_data.Telefone or "",
            fiscal_id
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado"
            )
        
        # Busca fiscal atualizado
        sql_select = "SELECT FIRST 1 FiscalId, Nome, Chave, Telefone FROM FISCAIS WHERE FiscalId=?"
        rows = await db.execute_query(sql_select, [fiscal_id])
        
        if rows:
            row = rows[0]
            logger.info(f"Fiscal {fiscal_id} atualizado")
            return FiscalResponse(
                FiscalId=row[0],
                Nome=row[1],
                Chave=row[2],
                Telefone=row[3]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar fiscal {fiscal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao atualizar fiscal"
        )

@router.delete("/{fiscal_id}")
async def delete_fiscal(fiscal_id: int):
    """Exclui fiscal - REGRA DE NEGÓCIO: Bloqueia se há PS vinculadas"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica vínculos com PS
        if await check_fiscal_ps_vinculos(fiscal_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Não é possível excluir: há PS vinculadas a este fiscal."
            )
        
        # Exclui do banco
        sql = "DELETE FROM FISCAIS WHERE FiscalId=?"
        affected = await db.execute_query(sql, [fiscal_id])
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado"
            )
        
        logger.info(f"Fiscal {fiscal_id} excluído")
        return {"ok": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir fiscal {fiscal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao excluir fiscal"
        )

@router.get("/search/nome/{nome}", response_model=FiscalResponse)
async def get_fiscal_by_nome(nome: str):
    """Busca fiscal por nome - FUNÇÃO DE NEGÓCIO"""
    try:
        fiscal = await resolve_fiscal_by_name(nome)
        
        if not fiscal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não cadastrado na lista de fiscais"
            )
        
        return FiscalResponse(**fiscal)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar fiscal por nome {nome}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar fiscal"
        )
