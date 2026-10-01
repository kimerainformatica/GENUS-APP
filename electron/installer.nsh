; Script extra do instalador/desinstalador (NSIS), incluído pelo
; electron-builder via "nsis.include" no package.json.
;
; Desinstalar remove só o programa de C:\Program Files\Genus Contabilidade.
; Os dados da empresa (banco + backups) ficam em %APPDATA%\genus_contabilidade
; e só são apagados se o usuário confirmar DUAS vezes. Nunca são apagados:
;   - quando a desinstalação faz parte de uma ATUALIZAÇÃO (instalar uma versão
;     nova por cima roda o desinstalador antigo com ${isUpdated});
;   - em desinstalação silenciosa (/S): a resposta padrão é "Não".
;
; ⚠️ O nome da pasta abaixo tem que ser o mesmo de USER_DATA_DIR_NAME em
; electron/main.cjs — o electron:prepare confere isso e barra o build se
; divergirem (ver "Pasta dos dados" em electron/README.md).

!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
      "Deseja apagar também os DADOS do Genus Contabilidade (clientes, extratos, lançamentos e backups)?$\r$\n$\r$\nEscolha NÃO para manter os dados: ao reinstalar o programa, tudo volta como estava." \
      /SD IDNO IDYES genusConfirmDelete IDNO genusKeepData

    genusConfirmDelete:
      MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
        "ATENÇÃO: esta ação NÃO pode ser desfeita.$\r$\n$\r$\nTodos os dados e backups em %APPDATA%\genus_contabilidade serão apagados permanentemente.$\r$\n$\r$\nConfirma a exclusão dos dados?" \
        /SD IDNO IDYES genusDeleteData IDNO genusKeepData

    genusDeleteData:
      ; Instalação "para todos os usuários" usa o contexto "all" (ProgramData);
      ; os dados do Electron ficam no AppData do usuário atual.
      SetShellVarContext current
      RMDir /r "$APPDATA\genus_contabilidade"
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}

    genusKeepData:
  ${endIf}
!macroend
