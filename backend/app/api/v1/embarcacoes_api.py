#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Embarcações - TODAS as regras de negócio e validações
Baseado no server.js linha por linha
"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel, Field, validator
from datetime import date
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/embarcacoes", tags=["Embarcações"])

# === MODELS ===
class EmbarcacaoCreate(BaseModel):
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
        """TipoEmbarcacao máximo 20 caracteres - REGRA DO server.js"""
        if v and len(str(v)) > 20:
            raise ValueError('Tipo da embarcação deve ter no máximo 20 caracteres')
        return str(v)[:20] if v else None

class EmbarcacaoUpdate(BaseModel):
    Nome: str = Field(..., min_length=1, max_length=200)
    PrimeiraEntradaPorto: Optional[date] = None
    TipoEmbarcacao: Optional[str] = Field(None, max_length=20)

    @validator('Nome')
    def validate_nome(cls, v):
        if not v or not v.strip():
            raise ValueError('Nome da embarcação é obrigatório')
        return v.strip()

    @validator('TipoEmbarcacao')
    def validate_tipo(cls, v):
        if v and len(str(v)) > 20:
            raise ValueError('Tipo da embarcação deve ter no máximo 20 caracteres')
        return str(v)[:20] if v else None

class EmbarcacaoResponse(BaseModel):
    EmbarcacaoId: int
    Nome: str
    PrimeiraEntradaPorto: Optional[str] = None
    TipoEmbarcacao: Optional[str] = None

# === BUSINESS LOGIC FUNCTIONS ===
async def check_embarcacao_duplicates(nome: str, exclude_id: Optional[int] = None):
    """Verifica duplicatas de Nome - REGRA DE NEGÓCIO"""
    from app.config.database import db
    
    sql = "SELECT FIRST 1 EmbarcacaoId FROM EMBARCACOES WHERE UPPER(Nome) = UPPER(?)"
    params = [nome.strip()]
    
    if exclude_id:
        sql += " AND EmbarcacaoId <> ?"
        params.append(exclude_id)
    
    rows = await db.execute_query(sql, params)
    return len(rows) > 0

async def check_embarcacao_ps_vinculos(embarcacao_id: int):
    """Verifica se embarcação tem PS vinculadas"""
    from app.config.database import db
    
    sql = "SELECT FIRST 1 PassagemId FROM PASSAGENS WHERE EmbarcacaoId = ?"
    rows = await db.execute_query(sql, [embarcacao_id])
    return len(rows) > 0

# === API ENDPOINTS ===
@router.get("/", response_model=List[EmbarcacaoResponse])
async def list_embarcacoes():
    """Lista todas embarcações - MESMA LÓGICA DO server.js"""
    try:
        from app.config.database import db
        
        sql = "SELECT EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM EMBARCACOES ORDER BY Nome"
        rows = await db.execute_query(sql)
        
        embarcacoes = []
        for row in rows:
            embarcacoes.append(EmbarcacaoResponse(
                EmbarcacaoId=row[0],
                Nome=row[1],
                PrimeiraEntradaPorto=str(row[2]) if row[2] else None,
                TipoEmbarcacao=row[3]
            ))
        
        logger.info(f"Listadas {len(embarcacoes)} embarcações")
        return embarcacoes
        
    except Exception as e:
        logger.error(f"Erro ao listar embarcações: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao listar embarcações"
        )

@router.post("/", response_model=EmbarcacaoResponse, status_code=status.HTTP_201_CREATED)
async def create_embarcacao(embarcacao_data: EmbarcacaoCreate):
    """Cria nova embarcação - TODAS AS VALIDAÇÕES DO server.js"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica duplicatas por nome
        if await check_embarcacao_duplicates(embarcacao_data.Nome):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Embarcação já cadastrada com este nome"
            )
        
        # Insere no banco
        sql = "INSERT INTO EMBARCACOES (Nome, PrimeiraEntradaPorto, TipoEmbarcacao) VALUES (?,?,?)"
        params = [
            embarcacao_data.Nome,
            embarcacao_data.PrimeiraEntradaPorto,
            embarcacao_data.TipoEmbarcacao
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected > 0:
            # Busca a embarcação criada
            sql_select = "SELECT FIRST 1 EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM EMBARCACOES WHERE Nome = ? ORDER BY EmbarcacaoId DESC"
            rows = await db.execute_query(sql_select, [embarcacao_data.Nome])
            
            if rows:
                row = rows[0]
                logger.info(f"Embarcação criada: {embarcacao_data.Nome}")
                return EmbarcacaoResponse(
                    EmbarcacaoId=row[0],
                    Nome=row[1],
                    PrimeiraEntradaPorto=str(row[2]) if row[2] else None,
                    TipoEmbarcacao=row[3]
                )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao criar embarcação"
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar embarcação: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao criar embarcação"
        )

@router.put("/{embarcacao_id}", response_model=EmbarcacaoResponse)
async def update_embarcacao(embarcacao_id: int, embarcacao_data: EmbarcacaoUpdate):
    """Atualiza embarcação - TODAS AS VALIDAÇÕES DO server.js"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica duplicatas (excluindo a própria)
        if await check_embarcacao_duplicates(embarcacao_data.Nome, embarcacao_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Nome já utilizado por outra embarcação"
            )
        
        # Atualiza no banco
        sql = "UPDATE EMBARCACOES SET Nome=?, PrimeiraEntradaPorto=?, TipoEmbarcacao=? WHERE EmbarcacaoId=?"
        params = [
            embarcacao_data.Nome,
            embarcacao_data.PrimeiraEntradaPorto,
            embarcacao_data.TipoEmbarcacao,
            embarcacao_id
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Embarcação não encontrada"
            )
        
        # Busca embarcação atualizada
        sql_select = "SELECT FIRST 1 EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM EMBARCACOES WHERE EmbarcacaoId=?"
        rows = await db.execute_query(sql_select, [embarcacao_id])
        
        if rows:
            row = rows[0]
            logger.info(f"Embarcação {embarcacao_id} atualizada")
            return EmbarcacaoResponse(
                EmbarcacaoId=row[0],
                Nome=row[1],
                PrimeiraEntradaPorto=str(row[2]) if row[2] else None,
                TipoEmbarcacao=row[3]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Embarcação não encontrada"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar embarcação {embarcacao_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao atualizar embarcação"
        )

@router.delete("/{embarcacao_id}")
async def delete_embarcacao(embarcacao_id: int):
    """Exclui embarcação - REGRA DE NEGÓCIO: Bloqueia se há PS vinculadas"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica vínculos com PS
        if await check_embarcacao_ps_vinculos(embarcacao_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Não é possível excluir: há PS vinculadas a esta embarcação."
            )
        
        # Exclui do banco
        sql = "DELETE FROM EMBARCACOES WHERE EmbarcacaoId=?"
        affected = await db.execute_query(sql, [embarcacao_id])
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Embarcação não encontrada"
            )
        
        logger.info(f"Embarcação {embarcacao_id} excluída")
        return {"ok": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir embarcação {embarcacao_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao excluir embarcação"
        )
