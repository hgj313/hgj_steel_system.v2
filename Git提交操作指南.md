 # Git提交操作指南

## Git工作流程概述

Git的工作流程包含三个主要区域：
```
工作区 (Working Directory) → 暂存区 (Staging Area) → 本地仓库 (Local Repository) → 远程仓库 (Remote Repository)
```

## 1. 检查当前状态

### 查看文件修改状态
```bash
# 详细状态信息
git status

# 简洁格式显示
git status --porcelain
```

### 查看具体修改内容
```bash
# 查看工作区的修改（未暂存的修改）
git diff

# 查看暂存区的修改（已暂存的修改）
git diff --staged

# 查看特定文件的修改
git diff filename.txt
```

## 2. 添加文件到暂存区（缓冲区）

### 基本添加命令
```bash
# 添加所有修改的文件
git add .

# 添加所有修改的文件（包括删除的文件）
git add -A

# 添加特定文件
git add filename.txt

# 添加多个特定文件
git add file1.txt file2.txt file3.txt

# 添加特定目录下的所有文件
git add src/

# 添加特定类型的文件
git add *.js
git add *.css
```

### 交互式添加
```bash
# 交互式添加，可以选择性添加文件的部分内容
git add -i

# 分块添加，逐个确认每个修改块
git add -p filename.txt
```

### 从暂存区移除文件
```bash
# 从暂存区移除文件（保留工作区修改）
git restore --staged filename.txt

# 移除所有暂存的文件
git restore --staged .

# 旧版本Git使用
git reset HEAD filename.txt
```

## 3. 提交到本地仓库

### 基本提交命令
```bash
# 提交暂存区的所有文件
git commit -m "提交说明信息"

# 提交并跳过暂存区（直接提交所有已跟踪的修改文件）
git commit -am "提交说明信息"

# 修改最后一次提交的说明
git commit --amend -m "新的提交说明"

# 空提交（没有文件变化，只是添加提交记录）
git commit --allow-empty -m "空提交说明"
```

### 多行提交说明
```bash
# 打开编辑器编写详细提交说明
git commit

# 或者在命令行中使用多行
git commit -m "简短标题

详细说明第一行
详细说明第二行
- 修改了功能A
- 优化了性能B"
```

## 4. 推送到远程仓库

### 基本推送命令
```bash
# 推送到默认远程仓库的当前分支
git push

# 推送到指定远程仓库和分支
git push origin master
git push origin main

# 首次推送新分支
git push -u origin new-branch

# 强制推送（谨慎使用）
git push --force
git push -f
```

### 推送标签
```bash
# 推送单个标签
git push origin v1.0.0

# 推送所有标签
git push --tags
```

## 5. 常用检查命令

### 查看提交历史
```bash
# 查看提交历史
git log

# 简洁格式显示
git log --oneline

# 查看最近5次提交
git log --oneline -5

# 图形化显示分支
git log --graph --oneline

# 查看特定文件的修改历史
git log filename.txt
```

### 查看远程仓库信息
```bash
# 查看远程仓库
git remote -v

# 查看分支信息
git branch
git branch -a  # 包括远程分支

# 查看当前分支状态
git status -b
```

## 6. 完整操作流程示例

```bash
# 1. 检查当前状态
git status

# 2. 查看具体修改（可选）
git diff

# 3. 添加文件到暂存区
git add .

# 4. 确认暂存区状态
git status

# 5. 提交到本地仓库
git commit -m "功能描述：修改了什么内容"

# 6. 推送到远程仓库
git push origin master
```

## 7. 撤销操作

### 撤销工作区修改
```bash
# 撤销单个文件的修改
git restore filename.txt

# 撤销所有文件的修改
git restore .

# 旧版本Git使用
git checkout -- filename.txt
```

### 撤销暂存区操作
```bash
# 从暂存区移除但保留工作区修改
git restore --staged filename.txt

# 移除所有暂存的文件
git restore --staged .
```

### 撤销提交
```bash
# 撤销最后一次提交，保留修改在工作区
git reset --soft HEAD~1

# 撤销最后一次提交，保留修改在暂存区
git reset --mixed HEAD~1

# 撤销最后一次提交，完全删除修改
git reset --hard HEAD~1
```

## 8. 提交说明规范

### 良好的提交说明格式
```
类型(范围): 简短描述

详细描述（可选）

- 修改项目1
- 修改项目2
```

### 常用类型标识
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档修改
- `style`: 代码格式修改
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 示例
```bash
git commit -m "feat(模数钢材): 添加模数钢材统计功能

- 新增模数钢材使用量统计
- 添加Excel导出统计表
- 优化前端显示界面"
```

## 9. 常见问题解决

### "Everything up-to-date" 问题
这通常表示本地没有新的提交需要推送：
1. 检查是否有未提交的修改：`git status`
2. 添加修改到暂存区：`git add .`
3. 提交修改：`git commit -m "说明"`
4. 推送：`git push`

### SSH密钥问题
```bash
# 生成SSH密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub

# 测试SSH连接
ssh -T git@github.com
```

### 合并冲突解决
```bash
# 查看冲突文件
git status

# 手动编辑冲突文件，然后
git add conflicted-file.txt
git commit -m "解决合并冲突"
```

## 10. 最佳实践

1. **频繁提交**：小步快跑，每个功能点都及时提交
2. **清晰的提交说明**：让其他人（包括未来的自己）能理解修改内容
3. **推送前检查**：使用 `git status` 和 `git log` 确认提交内容
4. **分支开发**：重要功能在分支上开发，完成后合并
5. **定期推送**：避免本地积累过多提交

## 11. 针对您刚才遇到的问题

当您看到 "Everything up-to-date" 时，按以下步骤操作：

```bash
# 1. 检查是否有未提交的修改
git status

# 2. 如果有修改的文件，添加到暂存区
git add .

# 3. 提交修改
git commit -m "描述修改内容"

# 4. 推送到远程仓库
git push origin master
```

这样就能成功将您的修改推送到GitHub了！