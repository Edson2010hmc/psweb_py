#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Layer para Administradores
"""

from app.config.database import db
from app.models.administrador import Administrador, AdministradorCreate, AdministradorUpdate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class AdministradorService:
    """Service para operações com Administradores"""
    
    async def get_all_administradores(self) -> List[Administrador]:
        """Retorna todos os administradores cadastrados"""
        try:
            sql = "SELECT ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES ORDER BY NOME"
            rows = await db.execute_query(sql)
            
            administradores = []
            for row in rows:
                administrador_data = {
                    "ADMINISTRADORID": row[0],
                    "nome": row[1],
                    "chave": row[2],
                    "telefone": row[3]
                }
                administradores.append(Administrador(**administrador_data))
            
            logger.info(f"Recuperados {len(administradores)} administradores do banco")
            return administradores
            
        except Exception as e:
            logger.error(f"Erro ao buscar administradores: {e}")
            raise
    
    async def get_administrador_by_id(self, administrador_id: int) -> Optional[Administrador]:
        """Busca um administrador por ID"""
        try:
            sql = "SELECT FIRST 1 ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES WHERE ADMINISTRADORID = ?"
            rows = await db.execute_query(sql, [administrador_id])
            
            if not rows:
                logger.warning(f"Administrador com ID {administrador_id} não encontrado")
                return None
            
            row = rows[0]
            administrador_data = {
                "ADMINISTRADORID": row[0],
                "nome": row[1], 
                "chave": row[2],
                "telefone": row[3]
            }
            
            administrador = Administrador(**administrador_data)
            logger.info(f"Administrador encontrado: {administrador.nome} (ID: {administrador_id})")
            return administrador
            
        except Exception as e:
            logger.error(f"Erro ao buscar administrador {administrador_id}: {e}")
            raise
    
    async def get_administrador_by_nome(self, nome: str) -> Optional[Administrador]:
        """Busca administrador por nome (usado para autenticação)"""
        try:
            sql = "SELECT FIRST 1 ADMINISTRADORID, NOME, CHAVE, TELEFONE FROM ADMINISTRADORES WHERE UPPER(NOME) = UPPER(?)"
            rows = await db.execute_query(sql, [nome.strip()])
            
            if not rows:
                logger.warning(f"Administrador com nome '{nome}' não encontrado")
                return None
            
            row = rows[0]
            administrador_data = {
                "ADMINISTRADORID": row[0],
                "nome": row[1],
                "chave": row[2], 
                "telefone": row[3]
            }
            
            administrador = Administrador(**administrador_data)
            logger.info(f"Administrador encontrado por nome: {administrador.nome}")
            return administrador
            
        except Exception as e:
            logger.error(f"Erro ao buscar administrador por nome '{nome}': {e}")
            raise
    
    async def create_administrador(self, administrador_data: AdministradorCreate) -> Administrador:
        """Cria um novo administrador"""
        try:
            # Verifica duplicatas por nome
            existing_nome = await self.get_administrador_by_nome(administrador_data.nome)
            if existing_nome:
                raise ValueError("Já existe administrador com este nome")
            
            # Verifica duplicatas por chave
            sql_check_chave = "SELECT FIRST 1 ADMINISTRADORID FROM ADMINISTRADORES WHERE UPPER(CHAVE) = UPPER(?)"
            rows = await db.execute_query(sql_check_chave, [administrador_data.chave])
            if rows:
                raise ValueError("Já existe administrador com esta chave")
            
            # Insere novo administrador
            sql = """
                INSERT INTO ADMINISTRADORES (NOME, CHAVE, TELEFONE) 
                VALUES (?, ?, ?)
            """
            
            affected = await db.execute_query(sql, [
                administrador_data.nome.strip(),
                administrador_data.chave.upper(), 
                administrador_data.telefone.strip() if administrador_data.telefone else ''
            ])
            
            if affected > 0:
                # Busca o administrador criado
                novo_administrador = await self.get_administrador_by_nome(administrador_data.nome)
                if novo_administrador:
                    logger.info(f"Administrador criado com sucesso: {administrador_data.nome} (ID: {novo_administrador.administrador_id})")
                    return novo_administrador
                else:
                    raise Exception("Administrador criado mas não encontrado")
            else:
                raise Exception("Falha ao inserir administrador no banco")
                
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao criar administrador: {e}")
            raise Exception(f"Erro interno ao criar administrador: {str(e)}")
    
    async def update_administrador(self, administrador_id: int, administrador_data: AdministradorUpdate) -> Optional[Administrador]:
        """Atualiza um administrador existente"""
        try:
            # Verifica se o administrador existe
            existing = await self.get_administrador_by_id(administrador_id)
            if not existing:
                logger.warning(f"Tentativa de atualizar administrador inexistente: {administrador_id}")
                return None
            
            # Verifica duplicatas por chave (exceto o próprio administrador)
            sql_check_chave = """
                SELECT FIRST 1 ADMINISTRADORID FROM ADMINISTRADORES 
                WHERE UPPER(CHAVE) = UPPER(?) AND ADMINISTRADORID <> ?
            """
            rows = await db.execute_query(sql_check_chave, [administrador_data.chave, administrador_id])
            if rows:
                raise ValueError("Chave já utilizada por outro administrador")
            
            # Verifica duplicatas por nome (exceto o próprio administrador)
            sql_check_nome = """
                SELECT FIRST 1 ADMINISTRADORID FROM ADMINISTRADORES 
                WHERE UPPER(NOME) = UPPER(?) AND ADMINISTRADORID <> ?
            """
            rows = await db.execute_query(sql_check_nome, [administrador_data.nome, administrador_id])
            if rows:
                raise ValueError("Nome já utilizado por outro administrador")
            
            # Atualiza o administrador
            sql_update = """
                UPDATE ADMINISTRADORES 
                SET NOME = ?, CHAVE = ?, TELEFONE = ? 
                WHERE ADMINISTRADORID = ?
            """
            
            affected = await db.execute_query(sql_update, [
                administrador_data.nome.strip(),
                administrador_data.chave.upper(),
                administrador_data.telefone.strip() if administrador_data.telefone else '',
                administrador_id
            ])
            
            if affected == 0:
                logger.warning(f"Nenhuma linha afetada ao atualizar administrador {administrador_id}")
                return None
            
            logger.info(f"Administrador {administrador_id} atualizado com sucesso")
            
            # Retorna o administrador atualizado
            return await self.get_administrador_by_id(administrador_id)
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao atualizar administrador {administrador_id}: {e}")
            raise Exception(f"Erro interno ao atualizar administrador: {str(e)}")
    
    async def delete_administrador(self, administrador_id: int) -> bool:
        """Exclui um administrador"""
        try:
            # Verifica se o administrador existe
            existing = await self.get_administrador_by_id(administrador_id)
            if not existing:
                logger.warning(f"Tentativa de excluir administrador inexistente: {administrador_id}")
                return False
            
            # REGRA DE NEGÓCIO: Administradores podem ser excluídos sem verificação de vínculos
            # (diferente dos fiscais que não podem ser excluídos se têm PS vinculadas)
            
            # Exclui o administrador
            sql_delete = "DELETE FROM ADMINISTRADORES WHERE ADMINISTRADORID = ?"
            affected = await db.execute_query(sql_delete, [administrador_id])
            
            if affected == 0:
                logger.warning(f"Nenhuma linha afetada ao excluir administrador {administrador_id}")
                return False
            
            logger.info(f"Administrador {administrador_id} ({existing.nome}) excluído com sucesso")
            return True
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao excluir administrador {administrador_id}: {e}")
            raise Exception(f"Erro interno ao excluir administrador: {str(e)}")

# Instância global do serviço
administrador_service = AdministradorService()