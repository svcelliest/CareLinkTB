param(
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$image = "an2ns/carelink-tb:$Tag"

Write-Host "Pushing git commits ..."
git push

Write-Host "Building $image ..."
docker build --target production -t $image .

Write-Host "Pushing $image ..."
docker push $image

Write-Host "Done: $image"
