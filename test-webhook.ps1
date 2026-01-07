# Webhook Test Script for PowerShell
# Usage: .\test-webhook.ps1

$body = @'
{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "transaccion_test_123",
      "status": "APPROVED",
      "reference": "NIDO-c1f6a0ff-1704052800",
      "amount_in_cents": 1000000,
      "currency": "COP",
      "customer_email": "test@usuario.com",
      "payment_method_type": "CARD"
    }
  },
  "sent_at": "2026-01-05T21:00:00.000Z",
  "timestamp": 1704052800,
  "signature": {
    "properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
    "checksum": "fakesignature"
  },
  "environment": "test"
}
'@

Write-Host "🧪 Testing Wompi Webhook..." -ForegroundColor Cyan
Write-Host "Endpoint: http://localhost:3000/api/webhooks/wompi" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks/wompi" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}
