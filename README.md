# PSWEB Python

Sistema de Passagem de Serviço migrado para Python com FastAPI.

## Estrutura do Projeto

```
psweb_py/
├── backend/           # API Python com FastAPI
├── frontend/          # Interface web minimalista
├── storage/           # Arquivos das PS
├── migration/         # Scripts de migração
├── tests/            # Testes automatizados
└── docs/             # Documentação
```

## Instalação

1. Instalar dependências:
```bash
cd backend
pip install -r requirements.txt
```

2. Configurar ambiente:
```bash
cp .env.example .env
# Editar .env com suas configurações
```

3. Executar aplicação:
```bash
python app/main.py
```

## Desenvolvimento

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Frontend: http://localhost:8000/static/

## Migração

Scripts de migração na pasta `migration/`
