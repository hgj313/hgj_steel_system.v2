Write-Host "SSH推送脚本 - 钢材系统部署" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

Write-Host "检查Git状态..." -ForegroundColor Yellow
git status --porcelain

Write-Host "当前远程仓库配置:" -ForegroundColor Yellow
git remote -v

Write-Host "设置SSH远程仓库..." -ForegroundColor Yellow
git remote set-url origin git@github.com:hgj313/hgj_steel_system.v2.git

Write-Host "开始SSH推送..." -ForegroundColor Yellow
Write-Host "提示: 需要输入SSH密钥密码" -ForegroundColor Red

git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host "推送成功!" -ForegroundColor Green
    Write-Host "Netlify将自动开始重新部署" -ForegroundColor Blue
} else {
    Write-Host "推送失败" -ForegroundColor Red
    Write-Host "可能的解决方案:" -ForegroundColor Yellow
    Write-Host "1. 检查SSH密钥是否已添加到GitHub" -ForegroundColor White
    Write-Host "2. 测试SSH连接: ssh -T git@github.com" -ForegroundColor White
    Write-Host "3. 或使用HTTPS推送" -ForegroundColor White
}

Write-Host "脚本执行完成" -ForegroundColor Green 