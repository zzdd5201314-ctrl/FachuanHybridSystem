# Windows dev helpers

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Start-Project.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Status-Project.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Stop-Project.ps1
```

You can also target a single service:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Start-Project.ps1 -Service backend
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Start-Project.ps1 -Service frontend
```

URLs:

- Frontend: `http://127.0.0.1:5173/`
- Backend health: `http://127.0.0.1:8002/health/`

Logs:

- `backend\logs\codex-backend-live.log`
- `frontend\logs\codex-frontend-live.log`
