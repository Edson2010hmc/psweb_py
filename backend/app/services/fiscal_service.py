#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Layer para Fiscais
"""

from app.config.database import db
from app.models.fiscal import Fiscal, FiscalCreate, FiscalUpdate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class FiscalService:
    """Service para operações com Fiscais"""
    
    async def get_all_fiscais(self) -> List[Fiscal]:
        """Retorna todos os fiscais cadastrados"""
        try:
            sql = "SELECT FISCALID, NOME, CHAVE, TELEFONE FROM FISCAIS ORDER BY NOME"
            rows = await db.execute_query(sql)
            
            fiscais = []
            for row in rows:
                fiscal_data = {
                    "FISCALID": row[0],
                    "nome": row[1],
                    "chave": row[2],
                    "telefone": row[3]
                }
                fiscais.append(Fiscal(**fiscal_data))
            
            logger.info(f"Recuperados {len(fiscais)} fiscais do banco")
            return fiscais
            
        except Exception as e:
            logger.error(f"Erro ao buscar fiscais: {e}")
            raise
    
    async def get_fiscal_by_id(self, fiscal_id: int) -> Optional[Fiscal]:
        """Busca um fiscal por ID"""
        try:
            sql = "SELECT FIRST 1 FISCALID, NOME, CHAVE, TELEFONE FROM FISCAIS WHERE FISCALID = ?"
            rows = await db.execute_query(sql, [fiscal_id])
            
            if not rows:
                logger.warning(f"Fiscal com ID {fiscal_id} não encontrado")
                return None
            
            row = rows[0]
            fiscal_data = {
                "FISCALID": row[0],
                "nome": row[1], 
                "chave": row[2],
                "telefone": row[3]
            }
            
            fiscal = Fiscal(**fiscal_data)
            logger.info(f"Fiscal encontrado: {fiscal.nome} (ID: {fiscal_id})")
            return fiscal
            
        except Exception as e:
            logger.error(f"Erro ao buscar fiscal {fiscal_id}: {e}")
            raise
    
    async def get_fiscal_by_nome(self, nome: str) -> Optional[Fiscal]:
        """Busca fiscal por nome (usado para autenticação)"""
        try:
            sql = "SELECT FIRST 1 FISCALID, NOME, CHAVE, TELEFONE FROM FISCAIS WHERE UPPER(NOME) = UPPER(?)"
            rows = await db.execute_query(sql, [nome.strip()])
            
            if not rows:
                logger.warning(f"Fiscal com nome '{nome}' não encontrado")
                return None
            
            row = rows[0]
            fiscal_data = {
                "FISCALID": row[0],
                "nome": row[1],
                "chave": row[2], 
                "telefone": row[3]
            }
            
            fiscal = Fiscal(**fiscal_data)
            logger.info(f"Fiscal encontrado por nome: {fiscal.nome}")
            return fiscal
            
        except Exception as e:
            logger.error(f"Erro ao buscar fiscal por nome '{nome}': {e}")
            raise
    
    async def create_fiscal(self, fiscal_data: FiscalCreate) -> Fiscal:
        """Cria um novo fiscal"""
        try:
            # Verifica duplicatas por nome
            existing_nome = await self.get_fiscal_by_nome(fiscal_data.nome)
            if existing_nome:
                raise ValueError("Já existe fiscal com este nome")
            
            # Verifica duplicatas por chave
            sql_check_chave = "SELECT FIRST 1 FISCALID FROM FISCAIS WHERE UPPER(CHAVE) = UPPER(?)"
            rows = await db.execute_query(sql_check_chave, [fiscal_data.chave])
            if rows:
                raise ValueError("Já existe fiscal com esta chave")
            
            # Insere novo fiscal usando conexão direta (para RETURNING)
            sql = """
                INSERT INTO FISCAIS (NOME, CHAVE, TELEFONE) 
                VALUES (?, ?, ?) 
                RETURNING FISCALID
            """
            
            connection = db.get_connection()
            try:
                cursor = connection.cursor()
                cursor.execute(sql, [
                    fiscal_data.nome.strip(),
                    fiscal_data.chave.upper(), 
                    fiscal_data.telefone.strip() if fiscal_data.telefone else ''
                ])
                
                # Firebird RETURNING clause
                result = cursor.fetchone()
                if not result:
                    raise Exception("Falha ao obter ID do fiscal criado")
                
                new_id = result[0]
                connection.commit()
                
                logger.info(f"Fiscal criado com sucesso: {fiscal_data.nome} (ID: {new_id})")
                
                # Retorna o fiscal criado
                return await self.get_fiscal_by_id(new_id)
                
            except Exception as e:
                connection.rollback()
                raise
            finally:
                connection.close()
                
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao criar fiscal: {e}")
            raise Exception(f"Erro interno ao criar fiscal: {str(e)}")
    
    async def update_fiscal(self, fiscal_id: int, fiscal_data: FiscalUpdate) -> Optional[Fiscal]:
        """Atualiza um fiscal existente"""
        try:
            # Verifica se o fiscal existe
            existing = await self.get_fiscal_by_id(fiscal_id)
            if not existing:
                logger.warning(f"Tentativa de atualizar fiscal inexistente: {fiscal_id}")
                return None
            
            # Verifica duplicatas por chave (exceto o próprio fiscal)
            sql_check_chave = """
                SELECT FIRST 1 FISCALID FROM FISCAIS 
                WHERE UPPER(CHAVE) = UPPER(?) AND FISCALID <> ?
            """
            rows = await db.execute_query(sql_check_chave, [fiscal_data.chave, fiscal_id])
            if rows:
                raise ValueError("Chave já utilizada por outro fiscal")
            
            # Verifica duplicatas por nome (exceto o próprio fiscal)
            sql_check_nome = """
                SELECT FIRST 1 FISCALID FROM FISCAIS 
                WHERE UPPER(NOME) = UPPER(?) AND FISCALID <> ?
            """
            rows = await db.execute_query(sql_check_nome, [fiscal_data.nome, fiscal_id])
            if rows:
                raise ValueError("Nome já utilizado por outro fiscal")
            
            # Atualiza o fiscal
            sql_update = """
                UPDATE FISCAIS 
                SET NOME = ?, CHAVE = ?, TELEFONE = ? 
                WHERE FISCALID = ?
            """
            
            affected = await db.execute_query(sql_update, [
                fiscal_data.nome.strip(),
                fiscal_data.chave.upper(),
                fiscal_data.telefone.strip() if fiscal_data.telefone else '',
                fiscal_id
            ])
            
            if affected == 0:
                logger.warning(f"Nenhuma linha afetada ao atualizar fiscal {fiscal_id}")
                return None
            
            logger.info(f"Fiscal {fiscal_id} atualizado com sucesso")
            
            # Retorna o fiscal atualizado
            return await self.get_fiscal_by_id(fiscal_id)
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao atualizar fiscal {fiscal_id}: {e}")
            raise Exception(f"Erro interno ao atualizar fiscal: {str(e)}")
    
    async def delete_fiscal(self, fiscal_id: int) -> bool:
        """Exclui um fiscal (se não estiver vinculado a PS)"""
        try:
            # Verifica se o fiscal existe
            existing = await self.get_fiscal_by_id(fiscal_id)
            if not existing:
                logger.warning(f"Tentativa de excluir fiscal inexistente: {fiscal_id}")
                return False
            
            # Verifica vínculos com passagens
            sql_check_vinculos = """
                SELECT FIRST 1 PASSAGEMID FROM PASSAGENS 
                WHERE FISCALEMBARCANDOID = ? OR FISCALDESEMBARCANDOID = ?
            """
            rows = await db.execute_query(sql_check_vinculos, [fiscal_id, fiscal_id])
            if rows:
                raise ValueError("Não é possível excluir: há Passagens de Serviço vinculadas a este fiscal")
            
            # Exclui o fiscal
            sql_delete = "DELETE FROM FISCAIS WHERE FISCALID = ?"
            affected = await db.execute_query(sql_delete, [fiscal_id])
            
            if affected == 0:
                logger.warning(f"Nenhuma linha afetada ao excluir fiscal {fiscal_id}")
                return False
            
            logger.info(f"Fiscal {fiscal_id} ({existing.nome}) excluído com sucesso")
            return True
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao excluir fiscal {fiscal_id}: {e}")
            raise Exception(f"Erro interno ao excluir fiscal: {str(e)}")

# Instância global do serviço
fiscal_service = FiscalService()
