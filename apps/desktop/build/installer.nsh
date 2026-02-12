!macro customUnInstall
  ; Set context to current user only (not all users on the machine)
  SetShellVarContext current

  ; Ask user if they want to delete all app data
  ; Default answer is No (data preserved)
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "\
    Do you want to permanently delete ALL Ledgr data?$\n\
    $\n\
    This includes:$\n\
    - Your financial database (all accounts, transactions, investments)$\n\
    - Application settings and preferences$\n\
    - Backup files$\n\
    - Application logs and cache$\n\
    $\n\
    WARNING: This action CANNOT be undone.$\n\
    Your financial data will be permanently lost!" \
    /SD IDNO IDYES DeleteData IDNO SkipDelete

  DeleteData:
    ; Delete the app's userData directory
    ; electron-builder sets APP_FILENAME to the productName or custom value
    RMDir /r "$APPDATA\${APP_FILENAME}"
    ; Also try the scoped package name path in case userData resolved differently
    RMDir /r "$APPDATA\@ledgr\desktop"
    RMDir "$APPDATA\@ledgr"
    Goto Done

  SkipDelete:
    ; User chose No -- leave all data intact
    Goto Done

  Done:
!macroend
