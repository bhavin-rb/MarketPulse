$root = $PSScriptRoot

# Start Flask backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; pip install -r requirements.txt -q; python app.py"

# Start Vite frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm install --silent; npm run dev"

Write-Host "Starting backend on http://localhost:5000"
Write-Host "Starting frontend on http://localhost:5173"
Write-Host ""
Write-Host "Open http://localhost:5173 in your browser."
Write-Host "Close the two terminal windows to stop the servers."
