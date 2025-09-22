
set SRC=C:\Users\Public\psweb_py\backend\database\psweb1.fdb
set DEST=C:\Users\Public\psweb_py\backend\database\psweb.fdb
set OUT=C:\Users\Public\Firebird-4.0.5.3140-0-x64\schema_firebird.sql
set USR=SYSDBA
set PWD=masterkey
 
rem 1) Extrai o DDL
C:\Users\Public\Firebird-4.0.5.3140-0-x64\isql.exe -user %USR% -password %PWD% -ch UTF8 -nodbtriggers -x -d "%DEST%" -o "%OUT%" "%SRC%"
if errorlevel 1 goto :err
 
rem 2) Dropa o banco antigo (garanta que não há conexões!)
C:\Users\Public\Firebird-4.0.5.3140-0-x64\isql.exe -user %USR% -password %PWD% %SRC% -q -i nul <nul
if not errorlevel 1 (
  echo DROP DATABASE; | C:\Users\Public\Firebird-4.0.5.3140-0-x64\isql.exe -user %USR% -password %PWD% %SRC%
)
 
rem 3) Cria o novo banco a partir do DDL
C:\Users\Public\Firebird-4.0.5.3140-0-x64\isql.exe -user %USR% -password %PWD% -ch UTF8 -i "%OUT%"
if errorlevel 1 goto :err
 
echo OK.
exit /b 0
:err
echo Falhou. Verifique o log e dependências.
exit /b 1