#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuração de conexão com Firebird usando firebird-driver
"""

import logging
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

class FirebirdConnection:
    def __init__(self):
        """Inicializa conexão com configurações"""
        from app.config.settings import settings
        
        self.connection_params = {
            'database': settings.DB_NAME,
            'user': settings.DB_USER, 
            'password': settings.DB_PASS
        }
        
        # Teste de importação do driver
        try:
            import firebird.driver as fb_driver
            self.fb_driver = fb_driver
            logger.info("Driver firebird-driver importado com sucesso")
        except ImportError:
            logger.error("Driver firebird-driver não encontrado. Execute: pip install firebird-driver")
            raise
    
    def get_connection(self):
        """Retorna uma nova conexão com o banco"""
        try:
            return self.fb_driver.connect(**self.connection_params)
        except Exception as e:
            logger.error(f"Erro ao conectar com Firebird: {e}")
            raise
    
    async def execute_query(self, sql: str, params: Optional[List] = None) -> List[Any]:
        """Executa uma query e retorna os resultados"""
        connection = None
        try:
            connection = self.get_connection()
            cursor = connection.cursor()
            
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            
            # Para SELECT, retorna os resultados
            if sql.strip().upper().startswith('SELECT'):
                results = cursor.fetchall()
                cursor.close()
                return results
            else:
                # Para INSERT/UPDATE/DELETE, commit e retorna rowcount
                connection.commit()
                affected = cursor.rowcount
                cursor.close()
                return affected
                
        except Exception as e:
            if connection:
                try:
                    connection.rollback()
                except:
                    pass
            logger.error(f"Erro ao executar query: {e}")
            raise
        finally:
            if connection:
                try:
                    connection.close()
                except:
                    pass

# Instância global
db = FirebirdConnection()

async def init_database():
    """Inicializa a conexão com o banco"""
    try:
        connection = db.get_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0")
        table_count = cursor.fetchone()[0]
        cursor.close()
        connection.close()
        
        logger.info(f"Banco de dados conectado com sucesso. Tabelas: {table_count}")
        return True
    except Exception as e:
        logger.error(f"Falha ao inicializar banco: {e}")
        return False

def get_db():
    """Dependency injection para FastAPI"""
    return db
