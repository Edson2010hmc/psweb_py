#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API de Administradores - TODAS as regras de negócio e validações
Arquivo: backend/app/api/v1/administradores_api.py
Baseado no padrão dos fiscais
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from pydantic import BaseModel, Field, validator
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/administradores", tags=["Administradores"])

# === MODELS ===
class AdministradorCreate(BaseModel):
    Nome: str = Field(..., min_length=1, max_length=120, description="Nome completo do administrador")
    Chave: str = Field(..., min_length=4, max_length=4, description="Chave de EXATAMENTE 4 caracteres")
    Telefone: Optional[str] = Field(None, max_length=40, description="Telefone máximo 40 caracteres")

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
        """Telefone máximo 40 caracteres"""
        if v and len(str(v)) > 40:
            raise ValueError('Telefone deve ter no máximo 40 caracteres')
        return str(v)[:40] if v else ""

class AdministradorUpdate(BaseModel):
    Nome: str = Field(..., min_length=1, max_length=120)
    Chave: str = Field(..., min_length=4, max_length=4)
    Telefone: Optional[str] = Field(None, max_length=40)

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
        if v and len(str(v)) > 40:
            raise ValueError('Telefone deve ter no máximo 40 caracteres')
        return str(v)[:40] if v else ""

class AdministradorResponse(BaseModel):
    AdministradorId: int
    Nome: str
    Chave: str
    Telefone: Optional[str] = None

# === BUSINESS LOGIC FUNCTIONS ===
async def check_administrador_duplicates(nome: str, chave: str, exclude_id: Optional[int] = None):
    """Verifica duplicatas de Nome ou Chave - REGRA DE NEGÓCIO"""
    from app.config.database import db
    
    # Busca duplicatas
    sql = "SELECT FIRST 1 ADMINISTRADORID FROM ADMINISTRADORES WHERE (UPPER(NOME) = UPPER(?) OR UPPER(CHAVE) = UPPER(?))"
    params = [nome.strip(), chave.strip()]
    
    if exclude_id:
        sql += " AND ADMINISTRADORID <> ?"
        params.append(exclude_id)
    
    rows = await db.execute_query(sql, params)
    return len(rows) > 0

async def resolve_administrador_by_name(nome: str):
    """Resolve administrador por nome completo - FUNÇÃO DE NEGÓCIO"""
    from app.config.database import db
    
    sql = "SELECT FIRST 1 ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES WHERE UPPER(NOME) = UPPER(?)"
    rows = await db.execute_query(sql, [nome.strip()])
    
    if rows:
        row = rows[0]
        return {
            "AdministradorId": row[0],
            "Nome": row[1], 
            "Chave": row[2],
            "Telefone": row[3]
        }
    return None

# === API ENDPOINTS ===
@router.get("/", response_model=List[AdministradorResponse])
async def list_administradores():
    """Lista todos os administradores - MESMA LÓGICA DO fiscais"""
    try:
        from app.config.database import db
        
        sql = "SELECT ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES ORDER BY NOME"
        rows = await db.execute_query(sql)
        
        administradores = []
        for row in rows:
            administradores.append(AdministradorResponse(
                AdministradorId=row[0],
                Nome=row[1],
                Chave=row[2], 
                Telefone=row[3]
            ))
        
        logger.info(f"Listados {len(administradores)} administradores")
        return administradores
        
    except Exception as e:
        logger.error(f"Erro ao listar administradores: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar administradores"
        )

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_administrador(administrador_data: AdministradorCreate):
    """Cria novo administrador - TODAS AS VALIDAÇÕES DOS fiscais"""
    import traceback
    
    try:
        print(f"🔸 INICIO: Criando administrador {administrador_data.Nome}")
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica duplicatas
        print(f"🔸 VERIFICANDO: Duplicatas para {administrador_data.Nome}")
        if await check_administrador_duplicates(administrador_data.Nome, administrador_data.Chave):
            print(f"🔸 ERRO: Administrador já cadastrado")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ja cadastrado"  # Mesma mensagem do fiscal
            )
        
        print(f"🔸 INSERINDO: No banco de dados")
        # Insere no banco
        sql = "INSERT INTO ADMINISTRADORES (NOME, CHAVE, TELEFONE) VALUES (?,?,?)"
        params = [
            administrador_data.Nome,
            administrador_data.Chave,
            administrador_data.Telefone or ""
        ]
        
        affected = await db.execute_query(sql, params)
        print(f"🔸 RESULTADO: {affected} linhas afetadas")
        
        if affected > 0:
            # Busca o administrador criado para retornar
            print(f"🔸 BUSCANDO: Administrador criado")
            novo_administrador = await resolve_administrador_by_name(administrador_data.Nome)
            print(f"🔸 ENCONTRADO: {novo_administrador}")
            
            if novo_administrador:
                logger.info(f"Administrador criado: {administrador_data.Nome}")
                result = {"ok": True, "AdministradorId": novo_administrador["AdministradorId"]}
                print(f"🔸 RETORNANDO: {result}")
                return result
            else:
                print(f"🔸 ERRO: Administrador não encontrado após criação")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Administrador criado mas não encontrado"
                )
        else:
            print(f"🔸 ERRO: Nenhuma linha afetada")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar"
            )
            
    except HTTPException:
        print(f"🔸 HTTP EXCEPTION: Re-raising")
        raise
    except Exception as e:
        print(f"🔸 ERRO FATAL: {str(e)}")
        print(f"🔸 TRACEBACK: {traceback.format_exc()}")
        logger.error(f"Erro ao criar administrador: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao salvar"
        )

@router.put("/{administrador_id}", response_model=AdministradorResponse)
async def update_administrador(administrador_id: int, administrador_data: AdministradorUpdate):
    """Atualiza administrador - TODAS AS VALIDAÇÕES DOS fiscais"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Verifica duplicatas (excluindo o próprio)
        if await check_administrador_duplicates(administrador_data.Nome, administrador_data.Chave, administrador_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Chave já utilizada por outro administrador"
            )
        
        # Atualiza no banco
        sql = "UPDATE ADMINISTRADORES SET NOME=?, CHAVE=?, TELEFONE=? WHERE ADMINISTRADORID=?"
        params = [
            administrador_data.Nome,
            administrador_data.Chave,
            administrador_data.Telefone or "",
            administrador_id
        ]
        
        affected = await db.execute_query(sql, params)
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado"
            )
        
        # Busca administrador atualizado
        sql_select = "SELECT FIRST 1 ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES WHERE ADMINISTRADORID=?"
        rows = await db.execute_query(sql_select, [administrador_id])
        
        if rows:
            row = rows[0]
            logger.info(f"Administrador {administrador_id} atualizado")
            return AdministradorResponse(
                AdministradorId=row[0],
                Nome=row[1],
                Chave=row[2],
                Telefone=row[3]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar administrador {administrador_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao atualizar administrador"
        )

@router.delete("/{administrador_id}")
async def delete_administrador(administrador_id: int):
    """Exclui administrador - SEM verificação de vínculos (diferente dos fiscais)"""
    try:
        from app.config.database import db
        
        # REGRA DE NEGÓCIO: Administradores podem ser excluídos sem verificação de vínculos
        # (diferente dos fiscais que não podem ser excluídos se têm PS vinculadas)
        
        # Exclui do banco
        sql = "DELETE FROM ADMINISTRADORES WHERE ADMINISTRADORID=?"
        affected = await db.execute_query(sql, [administrador_id])
        
        if affected == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado"
            )
        
        logger.info(f"Administrador {administrador_id} excluído")
        return {"ok": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir administrador {administrador_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao excluir administrador"
        )

@router.get("/search/nome/{nome}", response_model=AdministradorResponse)
async def get_administrador_by_nome(nome: str):
    """Busca administrador por nome - FUNÇÃO DE NEGÓCIO"""
    try:
        administrador = await resolve_administrador_by_name(nome)
        
        if not administrador:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Administrador não encontrado com este nome"
            )
        
        return AdministradorResponse(**administrador)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar administrador por nome {nome}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar administrador"
        )