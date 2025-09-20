#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSWEB Python - Conexão com Firebird Embedded
Compatível com o banco existente do Node.js
"""

import fdb
import asyncio
from contextlib import asynccontextmanager, contextmanager
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import logging
from app.config.settings import settings

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FirebirdConnection:
    """Gerenciador de conexões com Firebird Embedded"""
    
    def __init__(self):
        self.connection_params = {
            'dsn': settings.DB_NAME,  # Caminho direto para o .fdb
            'user': settings.DB_USER,
            'password': settings.DB_PASS,
            'charset': 'UTF8'
        }
        self._test_connection()
    
    def _test_connection(self):
        """Testa a conexão inicial com o banco"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0")
                table_count = cursor.fetchone()[0]
                logger.info(f"Conexão OK - {table_count} tabelas de usuário encontradas")
        except Exception as e:
            logger.error(f"Falha na conexão com Firebird: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Context manager para conexões síncronas"""
        conn = None
        try:
            conn = fdb.connect(**self.connection_params)
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    @asynccontextmanager
    async def get_async_connection(self):
        """Context manager para conexões assíncronas"""
        conn = None
        try:
            # fdb não tem suporte nativo async, então executamos em thread
            loop = asyncio.get_event_loop()
            conn = await loop.run_in_executor(None, lambda: fdb.connect(**self.connection_params))
            yield conn
        except Exception as e:
            if conn:
                await loop.run_in_executor(None, conn.rollback)
            raise e
        finally:
            if conn:
                await loop.run_in_executor(None, conn.close)

class FirebirdQuery:
    """Utilitários para execução de queries"""
    
    def __init__(self):
        self.fb = FirebirdConnection()
    
    def execute_query(self, sql: str, params: Optional[List] = None) -> List[Dict[str, Any]]:
        """Executa query SELECT e retorna lista de dicionários"""
        with self.fb.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            
            # Pega nomes das colunas
            columns = [desc[0] for desc in cursor.description]
            
            # Converte resultados para lista de dicionários
            results = []
            for row in cursor.fetchall():
                row_dict = dict(zip(columns, row))
                # Converte valores None explicitamente
                for key, value in row_dict.items():
                    if value is None:
                        row_dict[key] = None
                results.append(row_dict)
            
            return results
    
    def execute_scalar(self, sql: str, params: Optional[List] = None) -> Any:
        """Executa query e retorna um único valor"""
        with self.fb.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            result = cursor.fetchone()
            return result[0] if result else None
    
    def execute_non_query(self, sql: str, params: Optional[List] = None) -> int:
        """Executa INSERT/UPDATE/DELETE e retorna linhas afetadas"""
        with self.fb.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            affected = cursor.rowcount
            conn.commit()
            return affected
    
    def execute_insert_returning(self, sql: str, params: Optional[List] = None) -> Optional[int]:
        """Executa INSERT RETURNING e retorna o ID inserido"""
        with self.fb.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params or [])
            result = cursor.fetchone()
            conn.commit()
            return result[0] if result else None
    
    async def execute_query_async(self, sql: str, params: Optional[List] = None) -> List[Dict[str, Any]]:
        """Versão assíncrona de execute_query"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.execute_query, sql, params)
    
    async def execute_non_query_async(self, sql: str, params: Optional[List] = None) -> int:
        """Versão assíncrona de execute_non_query"""  
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.execute_non_query, sql, params)

# Instância global para uso em toda aplicação
fb_query = FirebirdQuery()

# Funções de conveniência para compatibilidade com Node.js
async def query(sql: str, params: Optional[List] = None) -> List[List[Dict[str, Any]]]:
    """Simula a interface pool.query do Node.js retornando [rows, metadata]"""
    rows = await fb_query.execute_query_async(sql, params)
    metadata = {
        'affectedRows': 0,
        'insertId': None,
        'raw': rows
    }
    return [rows, metadata]

def query_sync(sql: str, params: Optional[List] = None) -> List[List[Dict[str, Any]]]:
    """Versão síncrona da query compatível com Node.js"""
    rows = fb_query.execute_query(sql, params)
    metadata = {
        'affectedRows': len(rows) if sql.strip().upper().startswith('SELECT') else 0,
        'insertId': None,
        'raw': rows
    }
    return [rows, metadata]

# Inicialização do banco
async def init_database():
    """Inicializa conexão e valida estrutura do banco"""
    try:
        logger.info("Inicializando conexão com Firebird...")
        
        # Testa conectividade
        fb_query._test_connection()
        
        # Valida tabelas essenciais
        essential_tables = ['PASSAGENS', 'FISCAIS', 'EMBARCACOES']
        for table in essential_tables:
            count = fb_query.execute_scalar(
                f"SELECT COUNT(*) FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = ?", 
                [table]
            )
            if count == 0:
                logger.warning(f"Tabela {table} não encontrada!")
            else:
                logger.info(f"Tabela {table} validada")
        
        logger.info("Banco de dados inicializado com sucesso")
        
    except Exception as e:
        logger.error(f"Erro na inicialização do banco: {e}")
        raise

# Exemplo de uso / teste
if __name__ == "__main__":
    # Teste básico
    try:
        # Teste síncrono
        fiscais = fb_query.execute_query("SELECT FIRST 5 * FROM FISCAIS")
        print(f"Encontrados {len(fiscais)} fiscais")
        
        # Teste de insert (comentado para segurança)
        # new_id = fb_query.execute_insert_returning(
        #     "INSERT INTO TESTE (CAMPO) VALUES (?) RETURNING ID",
        #     ["valor_teste"]
        # )
        
        print("Testes de conexão OK!")
        
    except Exception as e:
        print(f"Erro nos testes: {e}")