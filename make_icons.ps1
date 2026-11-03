# Generates PWA icons without external tools. Safe to re-run.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$icons = Join-Path $here 'icons'
New-Item -ItemType Directory -Force $icons | Out-Null

function New-Icon {
  param([int]$Size, [string]$Path, [switch]$Maskable)

  $scale = 4  # supersample for smooth edges
  $S = $Size * $scale
  $bmp = New-Object System.Drawing.Bitmap($S, $S)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'

  # background: full-bleed gradient + rounded corners only for non-maskable
  $rect = New-Object System.Drawing.Rectangle(0, 0, $S, $S)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255,99,102,241), [System.Drawing.Color]::FromArgb(255,67,56,202), 45)
  if ($Maskable) {
    $g.FillRectangle($grad, $rect)
  } else {
    $r = [int]($S * 0.22)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2*$r, 2*$r, 180, 90)
    $p.AddArc($S-2*$r, 0, 2*$r, 2*$r, 270, 90)
    $p.AddArc($S-2*$r, $S-2*$r, 2*$r, 2*$r, 0, 90)
    $p.AddArc(0, $S-2*$r, 2*$r, 2*$r, 90, 90)
    $p.CloseFigure()
    $g.FillPath($grad, $p)
    # subtle highlight circle
    $hl = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26,255,255,255))
    $g.FillEllipse($hl, [int]($S*0.55), [int]($S*0.62), [int]($S*0.7), [int]($S*0.7))
  }

  # rupee glyph
  if ($Maskable) { $fontSize = [int]($S*0.46) } else { $fontSize = [int]($S*0.58) }
  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $white = [System.Drawing.Brushes]::White
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'
  # nudge down slightly: rupee glyph has high base
  if ($Maskable) { $nudge = [float]($S*0.028) } else { $nudge = [float]($S*0.02) }
  $textRect = New-Object System.Drawing.RectangleF(0, $nudge, [float]$S, [float]$S*0.98)
  $g.DrawString([string]::new([char]0x20B9), $font, $white, $textRect, $fmt)

  $g.Dispose()
  $out = New-Object System.Drawing.Bitmap($Size, $Size)
  $og = [System.Drawing.Graphics]::FromImage($out)
  $og.InterpolationMode = 'HighQualityBicubic'
  $og.DrawImage($bmp, 0, 0, $Size, $Size)
  $og.Dispose()
  $out.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  $bmp.Dispose()
  Write-Host "wrote $Path"
}

New-Icon -Size 192 -Path (Join-Path $icons 'icon-192.png')
New-Icon -Size 512 -Path (Join-Path $icons 'icon-512.png')
New-Icon -Size 512 -Path (Join-Path $icons 'icon-512-maskable.png') -Maskable
New-Icon -Size 180 -Path (Join-Path $icons 'apple-touch-icon.png')
Write-Host 'All icons generated.'
