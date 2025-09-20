#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar e corrigir fiscal_service.py
Execute: python fix_fiscal_service.py
"""

from pathlib import Path

def check_fiscal_service_file(base_dir: Path):
    """Verifica o conteúdo atual do fiscal_service.py"""
    
    fiscal_service_path = base_dir / "backend/app/services/fiscal_service.py"
    
    print(f"📄 Verificando: {fiscal_service_path}")
    
    if not fiscal_service_path.exists():
        print("❌ Arquivo fiscal_service.py não encontrado!")
        return None
    
    try:
        content = fiscal_service_path.read_text(encoding='utf-8')
        print(f"📏 Tamanho: {len(content)} caracteres")
        
        # Verifica se tem a instância fiscal_service no final
        if "fiscal_service = FiscalService()" in content:
            print("✅ Instância fiscal_service encontrada")
        else:
            print("❌ Instância fiscal_service NÃO encontrada")
        
        # Mostra as últimas linhas
        lines = content.split('\n')
        print("\n📋 Últimas 10 linhas:")
        for i, line in enumerate(lines[-10:], len(lines)-9):
            if line.strip():
                print(f"{i:3d}: {line}")
        
        return content
        
    except Exception as e:
        print(f"❌ Erro ao ler arquivo: {e}")
        return None

def create_corrected_fiscal_service(base_dir: Path):
    """Cria uma versão corrigida do fiscal_service.py"""
    
    fiscal_service_content = '''#!/usr/bin/env python3
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
'''
    
    fiscal_service_path = base_dir / "backend/app/services/fiscal_service.py"
    
    try:
        # Faz backup se o arquivo existir
        if fiscal_service_path.exists():
            backup_path = fiscal_service_path.with_suffix('.py.backup2')
            fiscal_service_path.rename(backup_path)
            print(f"📁 Backup criado: {backup_path.name}")
        
        # Escreve nova versão
        fiscal_service_path.write_text(fiscal_service_content, encoding='utf-8')
        print(f"✅ Arquivo fiscal_service.py recriado")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar fiscal_service.py: {e}")
        return False

def fix_pydantic_warnings(base_dir: Path):
    """Corrige warnings do Pydantic nos modelos"""
    
    print("\n🔧 Corrigindo warnings do Pydantic...")
    
    fiscal_model_path = base_dir / "backend/app/models/fiscal.py"
    
    if not fiscal_model_path.exists():
        print("❌ Arquivo fiscal.py não encontrado")
        return False
    
    try:
        content = fiscal_model_path.read_text(encoding='utf-8')
        
        # Corrige a configuração do Pydantic
        old_config = '''class Config:
        from_attributes = True
        populate_by_name = True
        allow_population_by_field_name = True'''
        
        new_config = '''class Config:
        from_attributes = True
        populate_by_name = True'''
        
        if 'allow_population_by_field_name' in content:
            content = content.replace(old_config, new_config)
            
            fiscal_model_path.write_text(content, encoding='utf-8')
            print("✅ Warning do Pydantic corrigido")
            return True
        else:
            print("✅ Não há warnings para corrigir")
            return True
            
    except Exception as e:
        print(f"❌ Erro ao corrigir warnings: {e}")
        return False

def test_final_import(base_dir: Path):
    """Testa o import final"""
    
    print("\n🧪 Testando import final...")
    
    # Configura Python path
    backend_dir = base_dir / "backend"
    import sys
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    try:
        # Força reload se já foi importado
        modules_to_reload = [
            'app.services.fiscal_service',
            'app.models.fiscal', 
            'app.main'
        ]
        
        for module in modules_to_reload:
            if module in sys.modules:
                del sys.modules[module]
        
        # Testa import específico
        from app.services.fiscal_service import fiscal_service
        print("✅ fiscal_service importado com sucesso")
        
        # Testa import do main
        from app.main import app
        print("✅ app principal importado com sucesso")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro no import: {e}")
        return False

def main():
    """Função principal"""
    print("PSWEB Python - Correção do fiscal_service.py")
    print("=" * 60)
    
    base_dir = Path(__file__).parent
    
    try:
        # 1. Verifica arquivo atual
        current_content = check_fiscal_service_file(base_dir)
        
        # 2. Cria versão corrigida
        print("\n🔧 Recriando fiscal_service.py...")
        if not create_corrected_fiscal_service(base_dir):
            return False
        
        # 3. Corrige warnings do Pydantic
        fix_pydantic_warnings(base_dir)
        
        # 4. Testa import final
        if test_final_import(base_dir):
            print("\n🎉 fiscal_service.py corrigido com sucesso!")
            print("\nAgora execute: python run_server.py")
            return True
        else:
            print("\n❌ Ainda há problemas com o import")
            return False
        
    except Exception as e:
        print(f"\n❌ Erro durante correção: {e}")
        return False

if __name__ == "__main__":
    main()