# ==============================================================================
# Wildfire Flux Explorer - Standalone Android APK Build & Verification Script
# ==============================================================================
$ErrorActionPreference = "Stop"

$workspaceRoot = $PSScriptRoot
$sdkDir = "I:\tele\AutoraSolution-source\android-sdk"
$javaHome = "C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot"
$env:JAVA_HOME = $javaHome

$aapt2 = "$sdkDir\build-tools\35.0.0\aapt2.exe"
$d8 = "$sdkDir\build-tools\35.0.0\d8.bat"
$zipalign = "$sdkDir\build-tools\35.0.0\zipalign.exe"
$apksigner = "$sdkDir\build-tools\35.0.0\apksigner.bat"
$apkanalyzer = "$sdkDir\cmdline-tools\latest\bin\apkanalyzer.bat"
$androidJar = "$sdkDir\platforms\android-34\android.jar"
$javac = "$javaHome\bin\javac.exe"
$keystore = "$workspaceRoot\debug.keystore"

$buildDir = "$workspaceRoot\app\build"
$compiledResDir = "$buildDir\compiled_res"
$genDir = "$buildDir\gen"
$classesDir = "$buildDir\classes\java\main"
$dexDir = "$buildDir\dex"
$outputDir = "$buildDir\outputs\apk\debug"

Write-Host "=== 1. Preparing Build Directories ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $compiledResDir, $genDir, $classesDir, $dexDir, $outputDir -Force | Out-Null

Write-Host "=== 2. Compiling Android Resources (aapt2 compile) ===" -ForegroundColor Cyan
& $aapt2 compile --dir "$workspaceRoot\app\src\main\res" -o $compiledResDir

Write-Host "=== 3. Linking Resources & Manifest (aapt2 link) ===" -ForegroundColor Cyan
$manifest = "$workspaceRoot\app\src\main\AndroidManifest.xml"
$flatFiles = Get-ChildItem -Path "$compiledResDir\*.flat" | ForEach-Object { $_.FullName }
$resourcesAp_ = "$buildDir\resources.ap_"

& $aapt2 link `
    -I $androidJar `
    --manifest $manifest `
    --min-sdk-version 26 `
    --target-sdk-version 34 `
    --version-code 1 `
    --version-name "1.0.0" `
    --java $genDir `
    --auto-add-overlay `
    -o $resourcesAp_ `
    $flatFiles

Write-Host "=== 4. Compiling Java Source Files (javac) ===" -ForegroundColor Cyan
$javaSources = Get-ChildItem -Path "$workspaceRoot\app\src\main\java", $genDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& $javac -d $classesDir -cp "$androidJar;$classesDir" -source 17 -target 17 $javaSources

Write-Host "=== 5. Dexing Bytecode (d8) ===" -ForegroundColor Cyan
$classFiles = Get-ChildItem -Path $classesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
cmd.exe /c "`"$d8`" --min-api 26 --lib `"$androidJar`" --output `"$dexDir`" $($classFiles -join ' ')"

Write-Host "=== 6. Packaging APK with Forward-Slash Asset Entries ===" -ForegroundColor Cyan
$unalignedApk = "$buildDir\unaligned.apk"
Copy-Item -Path $resourcesAp_ -Destination $unalignedApk -Force

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($unalignedApk, [System.IO.Compression.ZipArchiveMode]::Update)
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$dexDir\classes.dex", "classes.dex") | Out-Null

$assetsBase = (Resolve-Path "$workspaceRoot\app\src\main\assets").Path
$assetFiles = Get-ChildItem -Path $assetsBase -Recurse -File
foreach ($f in $assetFiles) {
    $rel = $f.FullName.Substring($assetsBase.Length).TrimStart('\', '/')
    $entryName = "assets/" + ($rel -replace '\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entryName) | Out-Null
}
$zip.Dispose()

Write-Host "=== 7. Aligning Archive to 4-Byte Boundaries (zipalign) ===" -ForegroundColor Cyan
$alignedApk = "$buildDir\aligned.apk"
& $zipalign -v -f 4 $unalignedApk $alignedApk

Write-Host "=== 8. Cryptographic Signing (apksigner) ===" -ForegroundColor Cyan
$finalApk = "$outputDir\app-debug.apk"
cmd.exe /c "`"$apksigner`" sign --ks `"$keystore`" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out `"$finalApk`" `"$alignedApk`""

Write-Host "=== 9. Deliverable Verification ===" -ForegroundColor Green
Write-Host "Checking Signature..."
cmd.exe /c "`"$apksigner`" verify -v `"$finalApk`""

Write-Host "Checking 4-Byte Alignment..."
& $zipalign -c -v 4 $finalApk

Write-Host "Checking Asset Forward-Slash Paths..."
$testZip = [System.IO.Compression.ZipFile]::OpenRead($finalApk)
$entry = $testZip.GetEntry("assets/web/data/sites.json")
$testZip.Dispose()
if (-not $entry) { throw "Asset entry 'assets/web/data/sites.json' not found in APK!" }
Write-Host "Asset lookup 'assets/web/data/sites.json': SUCCESS!"

Write-Host "Checking Target SDK & App Summary..."
cmd.exe /c "`"$apkanalyzer`" manifest min-sdk `"$finalApk`""
cmd.exe /c "`"$apkanalyzer`" manifest target-sdk `"$finalApk`""
cmd.exe /c "`"$apkanalyzer`" apk summary `"$finalApk`""

Write-Host "`nBUILD & VERIFICATION SUCCESSFUL!" -ForegroundColor Green
