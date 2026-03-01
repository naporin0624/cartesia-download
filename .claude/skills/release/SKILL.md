---
name: release
description: Release the desktop app. Use when the user says "release", "リリース", or wants to publish a new version of the Electron desktop app.
disable-model-invocation: true
argument-hint: [version]
---

# Release Desktop App

Electron デスクトップアプリをリリースするワークフロー。

## Prerequisites

- main ブランチにいること
- リリース対象のコミットが push 済みであること

## Workflow

### 1. Determine version

引数 `$ARGUMENTS` でバージョンが指定されていればそれを使う。
指定がなければ以下を確認して提案する:

```bash
# 現在のバージョン
cat apps/desktop/package.json | grep '"version"'
# 直近のタグ
git tag --list 'desktop-v*' --sort=-v:refname | head -3
# 前回リリースからの変更
git log $(git tag --list 'desktop-v*' --sort=-v:refname | head -1)..HEAD --oneline -- apps/desktop/ packages/core/
```

バージョニングルール:

- **patch** (x.y.Z): バグ修正、軽微な変更
- **minor** (x.Y.0): 新機能追加、UI 変更
- **major** (X.0.0): 破壊的変更

### 2. Bump version in package.json

`apps/desktop/package.json` の `"version"` を更新する。

### 3. Commit and push

```
chore: bump desktop version to {version}
```

### 4. Create and push tag

```bash
git tag desktop-v{version}
git push origin desktop-v{version}
```

タグ形式は `desktop-v{version}` (例: `desktop-v1.2.0`)。
これにより `.github/workflows/release-desktop.yml` が起動し、macOS + Windows ビルドが走る。

### 5. Verify

```bash
gh run list --workflow=release-desktop.yml --limit 1
```

ワークフローの URL をユーザーに共有する。
