#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuração de conexão com Firebird - SOLUÇÃO FUNCIONAL
Baseada na aplicação cadastro3.py que FUNCIONA com Firebird 4.0
"""

import logging
import os
import ctypes
from typing import Optional, List, Any

logger = logging.getLogger(__name__)

class FirebirdConnection:
    def __init__(self):
        """Inicializa conexão com configurações FUNCIONAIS"""
        from app.config.settings import settings
        
        # CONFIGURAÇÃO CRÍTICA - baseada na aplicação funcional
        self._setup_firebird_environment()
        
        self.connection_params = {
            'dsn': settings.DB_NAME,  # Caminho direto como na aplicação funcional
            'user': settings.DB_USER, 
            'password': settings.DB_PASS,
            'charset': 'UTF8'
        }
        
        # Import do driver fdb (que FUNCIONA)
        try:
            import fdb
            self.fdb = fdb
            logger.info("Driver FDB importado com sucesso")
            
            # Teste inicial de conectividade
            self._test_initial_connection()
            
        except ImportError:
            logger.error("Driver FDB não encontrado. Execute: pip install fdb")
            raise
    
    def _setup_firebird_environment(self):
        """Configuração crítica do ambiente Firebird - COPIADA DA APLICAÇÃO FUNCIONAL"""
        firebird_dir = r"C:\Users\Public\Firebird-4.0.5.3140-0-x64"
        
        # 1. Adicionar diretório ao PATH (como na aplicação funcional)
        current_path = os.environ.get("PATH", "")
        if firebird_dir not in current_path:
            os.environ["PATH"] = firebird_dir + os.pathsep + current_path
            logger.info(f"PATH atualizado com: {firebird_dir}")
        
        # 2. Carregar explicitamente a fbclient.dll (CHAVE DO SUCESSO)
        try:
            dll_path = os.path.join(firebird_dir, "fbclient.dll")
            if os.path.exists(dll_path):
                ctypes.windll.LoadLibrary(dll_path)
                logger.info(f"fbclient.dll carregada explicitamente: {dll_path}")
            else:
                logger.warning(f"fbclient.dll não encontrada em: {dll_path}")
        except Exception as e:
            logger.error(f"Erro ao carregar fbclient.dll: {e}")
    
    def _test_initial_connection(self):
        """Teste inicial como na aplicação funcional"""
        try:
            test_conn = self.fdb.connect(**self.connection_params)
            test_conn.close()
            logger.info("Teste inicial de conexão bem-sucedido")
        except Exception as e:
            logger.warning(f"Teste inicial falhou: {e}")
    
    def get_connection(self):
        """Retorna uma nova conexão - método da aplicação funcional"""
        try:
            return self.fdb.connect(**self.connection_params)
        except Exception as e:
            logger.error(f"Erro ao conectar com Firebird: {e}")
            raise
    
    async def execute_query(self, sql: str, params: Optional[List] = None) -> List[Any]:
        """Executa query - adaptado para async mas mantendo lógica funcional"""
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
                # FIREBIRD: -1 significa "não determinado" mas operação foi bem-sucedida
                if affected == -1:
                    return 1  # Assume 1 linha afetada para INSERT/UPDATE/DELETE
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
    
    def execute_query_sync(self, sql: str, params: Optional[List] = None) -> List[Any]:
        """Versão síncrona como na aplicação funcional"""
        connection = None
        try:
            connection = self.get_connection()
            cursor = connection.cursor()
            
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
            
            if sql.strip().upper().startswith('SELECT'):
                results = cursor.fetchall()
                cursor.close()
                return results
            else:
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
    """Inicializa a conexão com o banco - método FUNCIONAL"""
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
