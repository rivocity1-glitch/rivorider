$ErrorActionPreference = 'Stop'

$registerPath = Join-Path $PSScriptRoot '..\src\app\(auth)\register.tsx'
$deliveriesPath = Join-Path $PSScriptRoot '..\src\app\(tabs)\deliveries.tsx'

$register = Get-Content -Raw $registerPath

$passwordBlock = @'
  const passwordValid = password.length === 6;
'@

$registerPattern = '(?s)  const passwordHasMinLength =.*?  const passwordStrength =\s*getPasswordStrength\(\);'
$registerUpdated = [regex]::Replace($register, $registerPattern, $passwordBlock.TrimEnd(), 1)
if ($registerUpdated -eq $register) {
  throw 'Could not locate the Rider registration password validation block.'
}

$registerUpdated = $registerUpdated.Replace(
"""                secureTextEntry={
                  !showPassword
                }""",
"""                secureTextEntry={
                  !showPassword
                }
                maxLength={6}"""
)
$registerUpdated = $registerUpdated.Replace(
"""                secureTextEntry={
                  !showConfirmPassword
                }""",
"""                secureTextEntry={
                  !showConfirmPassword
                }
                maxLength={6}"""
)
$registerUpdated = $registerUpdated.Replace(
"""        'Password must contain at least 8 characters, one uppercase letter, one lowercase letter and one number.'""",
"""        'Password must be exactly 6 characters. Letters, numbers and symbols are allowed.'"""
)

Set-Content -Path $registerPath -Value $registerUpdated -Encoding utf8

$deliveries = Get-Content -Raw $deliveriesPath
$oldQr = 'value={`upi://pay?pa=YOUR_UPI_ID_HERE&pn=Rivo%20City&am=${selectedOrder?.total_amount}&cu=INR&tn=Order%20${selectedOrder?.order_number}`} '
$oldQrExact = '<QRCode\s+\n?\s*value=\{`upi://pay\?pa=YOUR_UPI_ID_HERE&pn=Rivo%20City&am=\$\{selectedOrder\?\.total_amount\}&cu=INR&tn=Order%20\$\{selectedOrder\?\.order_number\}`\}'
$newQrLine = '                      value={`upi://pay?pa=atharvavedpanditrao-1%40okicici&pn=RivoCity&am=${selectedOrder?.total_amount}&cu=INR&tn=Order%20${selectedOrder?.order_number}`}'
$deliveriesUpdated = [regex]::Replace($deliveries, $oldQrExact, "<QRCode`r`n$newQrLine", 1)
if ($deliveriesUpdated -eq $deliveries) {
  throw 'Could not locate the Rider UPI QR placeholder.'
}
$deliveriesUpdated = $deliveriesUpdated.Replace('>Rivo City</Text>', '>RivoCity</Text>')
$deliveriesUpdated = $deliveriesUpdated.Replace('>YOUR_UPI_ID_HERE</Text>', '>atharvavedpanditrao-1@okicici</Text>')

Set-Content -Path $deliveriesPath -Value $deliveriesUpdated -Encoding utf8

Write-Host 'Rider password and payment UI patch applied.' -ForegroundColor Green
Write-Host 'Registration password: exactly 6 characters, any character type.'
Write-Host 'Payment QR UPI: atharvavedpanditrao-1@okicici'
