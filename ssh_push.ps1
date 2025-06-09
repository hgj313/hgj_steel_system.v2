# SSH推送脚本 - 钢材系统部署
# 作者: AI助手
# 用途: 解决SSH密钥推送问题

Write-Host "SSH推送脚本 - 钢材系统部署" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# 检查当前Git状态
Write-Host "`n检查Git状态..." -ForegroundColor Yellow
git status --porcelain

# 检查远程仓库配置
Write-Host "`n当前远程仓库配置:" -ForegroundColor Yellow
git remote -v

Write-Host "`n选择推送方法:" -ForegroundColor Cyan
Write-Host "1. 使用SSH推送 (需要输入密钥密码)"
Write-Host "2. 切换到HTTPS推送 (使用GitHub Token)"
Write-Host "3. 直接推送 (简单模式)"
Write-Host "4. 退出"

$choice = Read-Host "`n请选择 (1-4)"

switch ($choice) {
    "1" {
        Write-Host "`n使用SSH推送..." -ForegroundColor Yellow
        Write-Host "提示: 需要输入SSH密钥密码" -ForegroundColor Red
        
        # 确保使用SSH URL
        git remote set-url origin git@github.com:hgj313/hgj_steel_system.v2.git
        
        # 推送代码
        Write-Host "正在推送到GitHub..." -ForegroundColor Yellow
        git push origin master
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SSH推送成功!" -ForegroundColor Green
        } else {
            Write-Host "SSH推送失败" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host "`n切换到HTTPS推送..." -ForegroundColor Yellow
        
        # 切换到HTTPS URL
        git remote set-url origin https://github.com/hgj313/hgj_steel_system.v2.git
        
        Write-Host "提示: 需要输入GitHub用户名和Personal Access Token" -ForegroundColor Red
        Write-Host "Token获取地址: https://github.com/settings/tokens" -ForegroundColor Blue
        
        # 推送代码
        Write-Host "正在推送到GitHub..." -ForegroundColor Yellow
        git push origin master
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "HTTPS推送成功!" -ForegroundColor Green
        } else {
            Write-Host "HTTPS推送失败" -ForegroundColor Red
        }
    }
    
    "3" {
        Write-Host "`n直接推送模式..." -ForegroundColor Yellow
        
        # 推送代码
        Write-Host "正在推送到GitHub..." -ForegroundColor Yellow
        git push origin master
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "推送成功!" -ForegroundColor Green
            Write-Host "Netlify将自动开始重新部署" -ForegroundColor Blue
        } else {
            Write-Host "推送失败" -ForegroundColor Red
        }
    }
    
    "4" {
        Write-Host "`n退出脚本" -ForegroundColor Yellow
        exit
    }
    
    default {
        Write-Host "`n无效选择" -ForegroundColor Red
    }
}

Write-Host "`nSSH推送问题解决方案:" -ForegroundColor Cyan
Write-Host "1. 确保SSH密钥已添加到GitHub账户"
Write-Host "2. 检查SSH密钥权限"
Write-Host "3. 测试SSH连接: ssh -T git@github.com"
Write-Host "4. 使用SSH Agent缓存密钥"

Write-Host "`n相关链接:" -ForegroundColor Blue
Write-Host "- GitHub SSH设置: https://docs.github.com/en/authentication/connecting-to-github-with-ssh"

Write-Host "`n脚本执行完成" -ForegroundColor Green 