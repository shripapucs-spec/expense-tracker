# Minimal local static server for the Expense Tracker (no dependencies).
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8642/
$ErrorActionPreference = 'Stop'
$port = 8642
$root = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'
  '.webmanifest' = 'application/manifest+json'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
  $listener.Start()
} catch {
  Write-Host "Could not start on port ${port}: $($_.Exception.Message)"
  Write-Host 'Try a different port by editing this script.'
  exit 1
}
Write-Host "Serving '$root'"
Write-Host 'Open:        http://localhost:8642/'
Write-Host 'Same-device (phone on same Wi-Fi): your PC LAN IP — not supported by this listener, use the GitHub Pages deploy for iPhone testing.'
Write-Host 'Press Ctrl+C to stop.'

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ($path -eq '/') { $path = '/index.html' }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/').Replace('/', '\'))))
      if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or
          -not (Test-Path $file -PathType Leaf)) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('404 not found')
        $res.ContentType = 'text/plain'
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.Headers['Last-Modified'] = (Get-Item $file).LastWriteTime.ToString('R')
        $res.Headers['Cache-Control'] = 'no-cache'
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      try { $res.StatusCode = 500 } catch {}
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
