---
name: release
description: Release the desktop app. Use when the user says "release", "リリース", or wants to publish a new version of the Electron desktop app.
disable-model-invocation: true
argument-hint: [merge|status]
---

# Release Desktop App

release-please ベースの Electron デスクトップアプリリリースワークフロー。

## How it works

1. main への push で release-please が conventional commits を解析
2. バージョン bump + CHANGELOG 更新の PR を自動作成
3. PR マージで `desktop-v{version}` タグが自動生成
4. タグ push で `release-desktop.yml` が起動し macOS + Windows ビルドが走る

## Workflow

### 1. Check release-please PR

```bash
gh pr list --label "autorelease: pending" --json number,title,url
```

PR がなければ「リリース対象の変更がありません」と伝える。

### 2. Show changes

PR の内容をユーザーに共有する:

```bash
gh pr view {number} --json title,body,files
```

### 3. Merge (引数が `merge` または ユーザーが承認した場合)

```bash
gh pr merge {number} --merge --delete-branch
```

### 4. Verify build

```bash
# タグが作られたか確認
git fetch --tags
git tag --list 'desktop-v*' --sort=-v:refname | head -1

# ビルドワークフローの確認
gh run list --workflow=release-desktop.yml --limit 1
```

ワークフローの URL をユーザーに共有する。

## Troubleshooting

### release-please PR が作られない

- conventional commits (`feat:`, `fix:`, `refactor:` 等) を使っているか確認
- `chore:` は CHANGELOG に含まれないため PR が作られない場合がある

### manifest のバージョンがずれている

```bash
cat .release-please-manifest.json
cat apps/desktop/package.json | grep '"version"'
```

ずれている場合は manifest を手動で合わせてコミットする。
