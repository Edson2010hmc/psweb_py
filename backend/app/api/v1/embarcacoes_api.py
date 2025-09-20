#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Embarcações - REFATORADO para usar Service Layer
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
from app.models.embarcacao import Embarcacao, EmbarcacaoCreate, EmbarcacaoUpdate
from app.services.embarcacao_service import embarcacao_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/embarcacoes", tags=["Embarcações"])

@router.get("/", response_model=List[Embarcacao])
async def list_embarcacoes():
    """Lista todas embarcações - USA SERVICE LAYER"""
    try:
        embarcacoes = await embarcacao_service.get_all_embarcacoes()
        logger.info(f"Listadas {len(embarcacoes)} embarcações")
        return embarcacoes
        
    except Exception as e:
        logger.error(f"Erro ao listar embarcações: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao listar embarcações"
        )

@router.get("/{embarcacao_id}", response_model=Embarcacao)
async def get_embarcacao(embarcacao_id: int):
    """Busca embarcação por ID - USA SERVICE LAYER"""
    try:
        embarcacao = await embarcacao_service.get_embarcacao_by_id(embarcacao_id)
        if not embarcacao:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Embarcação não encontrada"
            )
        logger.info(f"Embarcação encontrada: {embarcacao.Nome}")
        return embarcacao
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar embarcação {embarcacao_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar embarcação"
        )

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_embarcacao(embarcacao_data: EmbarcacaoCreate):
    """Cria nova embarcação - USA SERVICE LAYER"""
    try:
        embarcacao = await embarcacao_service.create_embarcacao(embarcacao_data)
        logger.info(f"Embarcação criada: {embarcacao.Nome} (ID: {embarcacao.EmbarcacaoId})")
        return {"ok": True, "EmbarcacaoId": embarcacao.EmbarcacaoId}
        
    except ValueError as e:
        logger.warning(f"Erro de validação ao criar embarcação: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Erro ao criar embarcação: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao criar embarcação"
        )

@router.put("/{embarcacao_id}", response_model=Embarcacao)
async def update_embarcacao(embarcacao_id: int, embarcacao_data: EmbarcacaoUpdate):
    """Atualiza embarcação - USA SERVICE LAYER"""
    try:
        embarcacao = await embarcacao_service.update_embarcacao(embarcacao_id, embarcacao_data)
        if not embarcacao:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Embarcação não encontrada"
            )
        logger.info(f"Embarcação atualizada: {embarcacao.Nome} (ID: {embarcacao_id})")
        return embarcacao
        
    except ValueError as e:
        logger.warning(f"Erro de validação ao atualizar embarcação: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
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
    """Exclui embarcação - USA SERVICE LAYER"""
    try:
        deleted = await embarcacao_service.delete_embarcacao(embarcacao_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Embarcação não encontrada"
            )
        logger.info(f"Embarcação {embarcacao_id} excluída")
        return {"ok": True}
        
    except ValueError as e:
        logger.warning(f"Erro de validação ao excluir embarcação: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir embarcação {embarcacao_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao excluir embarcação"
        )