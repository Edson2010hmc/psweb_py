@echo off
echo ========================================
echo     ATUALIZACAO REPOSITORIO GIT
echo ========================================
echo.

:: Inicializa o repositório (se não existir)
git init

:: Adiciona todos os arquivos
echo [1] Adicionando arquivos...
git add .

:: Commit com a data atual
echo [2] Fazendo commit...
git commit -m "%date%"

:: Configura usuário
echo [3] Configurando usuário...
git config --global user.name "Edson2010hmc"
git config --global user.email "edson.quaresma@petrobras.com.br"

:: Remove origin se já existir e adiciona novamente
echo [4] Configurando repositório remoto...
git remote remove origin 2>nul
git remote add origin https://github.com/Edson2010hmc/psweb_py.git

:: Configura branch principal
echo [5] Configurando branch main...
git branch -M main

:: Faz push (com force se necessário)
echo [6] Enviando para GitHub...
git push -u origin main
if %errorlevel% neq 0 (
    echo ⚠️  Push normal falhou. Tentando com --force...
    git push -u origin main --force
    if %errorlevel% equ 0 (
        echo ✅ Push forcado realizado com sucesso!
    ) else (
        echo ❌ Falha no push. Verifique sua conexão e credenciais.
    )
) else (
    echo ✅ Repositório atualizado com sucesso!
)

echo.
echo ========================================
echo           PROCESSO CONCLUÍDO
echo ========================================
pause
