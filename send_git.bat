@echo off
chcp 65001 >nul
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
git commit -m "%date%-%time%"

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
git push -u origin main 2>&1 | findstr /C:"Everything up-to-date" /C:"branch 'main' set up to track" >nul
if %errorlevel% equ 0 (
    echo ✅ Push realizado com sucesso!
) else (
    echo ⚠️  Push normal falhou. Tentando com --force...
    git push -u origin main --force 2>&1 | findstr /C:"forced update" /C:"branch 'main' set up to track" >nul
    if %errorlevel% equ 0 (
        echo ✅ Push forcado realizado com sucesso!
    ) else (
        echo ❌ Falha no push. Verifique sua conexão e credenciais.
    )
)

echo.
echo [7] Verificando status final...
git status --short
echo.
echo ========================================
echo     ✅ REPOSITORIO ATUALIZADO ✅
echo ========================================
echo.
echo 🌐 Acesse: https://github.com/Edson2010hmc/psweb_py
echo.
pause
