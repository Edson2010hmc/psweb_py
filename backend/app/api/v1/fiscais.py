#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Fiscais - Rotas Completas
Localização: backend/app/api/v1/fiscais.py
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from app.models.fiscal import Fiscal, FiscalCreate, FiscalUpdate
from app.services.fiscal_service import fiscal_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fiscais", tags=["Fiscais"])

@router.get("/", response_model=List[Fiscal])
async def list_fiscais():
    """Lista todos os fiscais cadastrados"""
    try:
        fiscais = await fiscal_service.get_all_fiscais()
        logger.info(f"Listando {len(fiscais)} fiscais")
        return fiscais
    except Exception as e:
        logger.error(f"Erro ao listar fiscais: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar fiscais: {str(e)}"
        )

@router.get("/{fiscal_id}", response_model=Fiscal)
async def get_fiscal(fiscal_id: int):
    """Busca um fiscal por ID"""
    try:
        fiscal = await fiscal_service.get_fiscal_by_id(fiscal_id)
        if not fiscal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado"
            )
        logger.info(f"Fiscal encontrado: {fiscal.nome}")
        return fiscal
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar fiscal {fiscal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar fiscal: {str(e)}"
        )

@router.post("/", response_model=Fiscal, status_code=status.HTTP_201_CREATED)
async def create_fiscal(fiscal_data: FiscalCreate):
    """Cria um novo fiscal"""
    try:
        fiscal = await fiscal_service.create_fiscal(fiscal_data)
        logger.info(f"Fiscal criado: {fiscal.nome} (ID: {fiscal.fiscal_id})")
        return fiscal
    except ValueError as e:
        logger.warning(f"Erro de validação ao criar fiscal: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Erro ao criar fiscal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar fiscal: {str(e)}"
        )

@router.put("/{fiscal_id}", response_model=Fiscal)
async def update_fiscal(fiscal_id: int, fiscal_data: FiscalUpdate):
    """Atualiza um fiscal existente"""
    try:
        fiscal = await fiscal_service.update_fiscal(fiscal_id, fiscal_data)
        if not fiscal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado"
            )
        logger.info(f"Fiscal atualizado: {fiscal.nome} (ID: {fiscal.fiscal_id})")
        return fiscal
    except ValueError as e:
        logger.warning(f"Erro de validação ao atualizar fiscal: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar fiscal {fiscal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar fiscal: {str(e)}"
        )

@router.delete("/{fiscal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fiscal(fiscal_id: int):
    """Exclui um fiscal"""
    try:
        deleted = await fiscal_service.delete_fiscal(fiscal_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado"
            )
        logger.info(f"Fiscal {fiscal_id} excluído com sucesso")
    except ValueError as e:
        logger.warning(f"Erro de validação ao excluir fiscal: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir fiscal {fiscal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao excluir fiscal: {str(e)}"
        )

@router.get("/nome/{nome}", response_model=Fiscal)
async def get_fiscal_by_nome(nome: str):
    """Busca fiscal por nome (usado para autenticação)"""
    try:
        fiscal = await fiscal_service.get_fiscal_by_nome(nome)
        if not fiscal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado com este nome"
            )
        logger.info(f"Fiscal encontrado por nome: {fiscal.nome}")
        return fiscal
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar fiscal por nome {nome}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar fiscal por nome: {str(e)}"
        )

@router.get("/chave/{chave}", response_model=Fiscal)
async def get_fiscal_by_chave(chave: str):
    """Busca fiscal por chave"""
    try:
        # Implementação similar ao buscar por nome
        sql = "SELECT FIRST 1 FiscalId, Nome, Chave, Telefone FROM Fiscais WHERE UPPER(Chave) = UPPER(?)"
        from app.config.database import db
        rows = await db.execute_query(sql, [chave.strip().upper()])
        
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fiscal não encontrado com esta chave"
            )
        
        row = rows[0]
        fiscal_data = {
            "FiscalId": row[0],
            "nome": row[1],
            "chave": row[2],
            "telefone": row[3]
        }
        
        fiscal = Fiscal(**fiscal_data)
        logger.info(f"Fiscal encontrado por chave: {fiscal.nome}")
        return fiscal
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar fiscal por chave {chave}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar fiscal por chave: {str(e)}"
        )