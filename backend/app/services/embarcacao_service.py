#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Layer para Embarcações
"""

from app.config.database import db
from app.models.embarcacao import Embarcacao, EmbarcacaoCreate, EmbarcacaoUpdate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class EmbarcacaoService:
    """Service para operações com Embarcações"""
    
    async def get_all_embarcacoes(self) -> List[Embarcacao]:
        """Retorna todas as embarcações cadastradas"""
        try:
            sql = "SELECT EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM EMBARCACOES ORDER BY Nome"
            rows = await db.execute_query(sql)
            
            embarcacoes = []
            for row in rows:
                embarcacao_data = {
                    "EmbarcacaoId": row[0],
                    "Nome": row[1],
                    "PrimeiraEntradaPorto": row[2],
                    "TipoEmbarcacao": row[3]
                }
                embarcacoes.append(Embarcacao(**embarcacao_data))
            
            logger.info(f"Recuperadas {len(embarcacoes)} embarcações do banco")
            return embarcacoes
            
        except Exception as e:
            logger.error(f"Erro ao buscar embarcações: {e}")
            raise
    
    async def get_embarcacao_by_id(self, embarcacao_id: int) -> Optional[Embarcacao]:
        """Busca uma embarcação por ID"""
        try:
            sql = "SELECT FIRST 1 EmbarcacaoId, Nome, PrimeiraEntradaPorto, TipoEmbarcacao FROM EMBARCACOES WHERE EmbarcacaoId = ?"
            rows = await db.execute_query(sql, [embarcacao_id])
            
            if not rows:
                logger.warning(f"Embarcação com ID {embarcacao_id} não encontrada")
                return None
            
            row = rows[0]
            embarcacao_data = {
                "EmbarcacaoId": row[0],
                "Nome": row[1],
                "PrimeiraEntradaPorto": row[2],
                "TipoEmbarcacao": row[3]
            }
            
            embarcacao = Embarcacao(**embarcacao_data)
            logger.info(f"Embarcação encontrada: {embarcacao.Nome} (ID: {embarcacao_id})")
            return embarcacao
            
        except Exception as e:
            logger.error(f"Erro ao buscar embarcação {embarcacao_id}: {e}")
            raise
    
    async def check_embarcacao_duplicates(self, nome: str, exclude_id: Optional[int] = None) -> bool:
        """Verifica duplicatas de Nome - REGRA DE NEGÓCIO"""
        try:
            sql = "SELECT FIRST 1 EmbarcacaoId FROM EMBARCACOES WHERE UPPER(Nome) = UPPER(?)"
            params = [nome.strip()]
            
            if exclude_id:
                sql += " AND EmbarcacaoId <> ?"
                params.append(exclude_id)
            
            rows = await db.execute_query(sql, params)
            return len(rows) > 0
            
        except Exception as e:
            logger.error(f"Erro ao verificar duplicatas: {e}")
            raise
    
    async def check_embarcacao_ps_vinculos(self, embarcacao_id: int) -> bool:
        """Verifica se embarcação tem PS vinculadas"""
        try:
            sql = "SELECT FIRST 1 PassagemId FROM PASSAGENS WHERE EmbarcacaoId = ?"
            rows = await db.execute_query(sql, [embarcacao_id])
            return len(rows) > 0
            
        except Exception as e:
            logger.error(f"Erro ao verificar vínculos: {e}")
            raise
    
    async def create_embarcacao(self, embarcacao_data: EmbarcacaoCreate) -> Embarcacao:
        """Cria uma nova embarcação"""
        try:
            # REGRA DE NEGÓCIO: Verifica duplicatas por nome
            if await self.check_embarcacao_duplicates(embarcacao_data.Nome):
                raise ValueError("Embarcação já cadastrada com este nome")
            
            # Insere nova embarcação
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
                    embarcacao_criada = Embarcacao(
                        EmbarcacaoId=row[0],
                        Nome=row[1],
                        PrimeiraEntradaPorto=row[2],
                        TipoEmbarcacao=row[3]
                    )
                    logger.info(f"Embarcação criada: {embarcacao_data.Nome} (ID: {embarcacao_criada.EmbarcacaoId})")
                    return embarcacao_criada
            
            raise Exception("Falha ao criar embarcação")
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao criar embarcação: {e}")
            raise Exception(f"Erro interno ao criar embarcação: {str(e)}")
    
    async def update_embarcacao(self, embarcacao_id: int, embarcacao_data: EmbarcacaoUpdate) -> Optional[Embarcacao]:
        """Atualiza uma embarcação existente"""
        try:
            # Verifica se a embarcação existe
            existing = await self.get_embarcacao_by_id(embarcacao_id)
            if not existing:
                logger.warning(f"Tentativa de atualizar embarcação inexistente: {embarcacao_id}")
                return None
            
            # REGRA DE NEGÓCIO: Verifica duplicatas (excluindo a própria)
            if await self.check_embarcacao_duplicates(embarcacao_data.Nome, embarcacao_id):
                raise ValueError("Nome já utilizado por outra embarcação")
            
            # Atualiza a embarcação
            sql_update = """
                UPDATE EMBARCACOES 
                SET Nome = ?, PrimeiraEntradaPorto = ?, TipoEmbarcacao = ? 
                WHERE EmbarcacaoId = ?
            """
            
            affected = await db.execute_query(sql_update, [
                embarcacao_data.Nome,
                embarcacao_data.PrimeiraEntradaPorto,
                embarcacao_data.TipoEmbarcacao,
                embarcacao_id
            ])
            
            if affected == 0:
                logger.warning(f"Nenhuma linha afetada ao atualizar embarcação {embarcacao_id}")
                return None
            
            logger.info(f"Embarcação {embarcacao_id} atualizada com sucesso")
            
            # Retorna a embarcação atualizada
            return await self.get_embarcacao_by_id(embarcacao_id)
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao atualizar embarcação {embarcacao_id}: {e}")
            raise Exception(f"Erro interno ao atualizar embarcação: {str(e)}")
    
    async def delete_embarcacao(self, embarcacao_id: int) -> bool:
        """Exclui uma embarcação (se não estiver vinculada a PS)"""
        try:
            # Verifica se a embarcação existe
            existing = await self.get_embarcacao_by_id(embarcacao_id)
            if not existing:
                logger.warning(f"Tentativa de excluir embarcação inexistente: {embarcacao_id}")
                return False
            
            # REGRA DE NEGÓCIO: Verifica vínculos com PS
            if await self.check_embarcacao_ps_vinculos(embarcacao_id):
                raise ValueError("Não é possível excluir: há PS vinculadas a esta embarcação")
            
            # Exclui a embarcação
            sql_delete = "DELETE FROM EMBARCACOES WHERE EmbarcacaoId = ?"
            affected = await db.execute_query(sql_delete, [embarcacao_id])
            
            if affected == 0:
                logger.warning(f"Nenhuma linha afetada ao excluir embarcação {embarcacao_id}")
                return False
            
            logger.info(f"Embarcação {embarcacao_id} ({existing.Nome}) excluída com sucesso")
            return True
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(f"Erro ao excluir embarcação {embarcacao_id}: {e}")
            raise Exception(f"Erro interno ao excluir embarcação: {str(e)}")

# Instância global do serviço
embarcacao_service = EmbarcacaoService()