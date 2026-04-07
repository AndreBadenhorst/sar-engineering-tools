# Backup & Version Control Guide

## Git Basics

Your code is tracked with **Git** and backed up to **GitHub**. Here's what you need to know.

### Daily Workflow

After making changes, run these three commands to back up:

```bash
# 1. Stage all changes
git add -A

# 2. Commit with a message describing what changed
git commit -m "Add night shift feature to capacity planner"

# 3. Push to GitHub (your online backup)
git push origin master
```

That's it. Your code is now safely on GitHub at:
**https://github.com/andrebadenhorst/sar-engineering-tools**

### Check What Changed

```bash
git status              # See what files changed
git diff                # See the actual changes
git log --oneline -10   # See last 10 commits
```

### Undo Mistakes

```bash
# Undo changes to a single file (before committing)
git checkout -- client/src/pages/capacity-planner.tsx

# Undo the last commit (keeps your files, just uncommits)
git reset --soft HEAD~1

# Go back to how GitHub looks (WARNING: loses all local changes)
git reset --hard origin/master
```

---

## What Gets Backed Up

| Backed Up | Not Backed Up (gitignored) |
|-----------|---------------------------|
| All source code | `node_modules/` (reinstall with `npm install`) |
| Configuration files | `dist/` (rebuild with `npm run build`) |
| Migrations & seeds | `data/*.db` (database — see below) |
| Shared schemas | `.DS_Store`, temp files |

---

## Database Backup

The SQLite database (`data/sar-tools.db`) is **not** in Git because it contains live data that changes constantly. Back it up separately.

### Manual Database Backup

```bash
# Copy the database file (do this regularly)
cp data/sar-tools.db data/backups/sar-tools-$(date +%Y%m%d).db
```

### Automated Daily Backup (Windows Task Scheduler)

1. Create `scripts/backup-db.bat`:
```bat
@echo off
set BACKUP_DIR=C:\Users\aba.SAR\Desktop\Co-Work\sar-engineering-tools\data\backups
set DB_FILE=C:\Users\aba.SAR\Desktop\Co-Work\sar-engineering-tools\data\sar-tools.db
set DATE=%date:~10,4%%date:~4,2%%date:~7,2%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
copy "%DB_FILE%" "%BACKUP_DIR%\sar-tools-%DATE%.db"

:: Keep only last 30 backups
forfiles /p "%BACKUP_DIR%" /m "sar-tools-*.db" /d -30 /c "cmd /c del @file" 2>nul
```

2. Open **Task Scheduler** > Create Basic Task > Run daily > Point to this `.bat` file.

### Restore from Backup

```bash
# Stop the server first, then:
cp data/backups/sar-tools-20260406.db data/sar-tools.db
```

### Rebuild Database from Scratch

If the database is lost, rebuild it:

```bash
npx tsx server/seed.ts                # Team members + activities
npx tsx server/migrate-projects.ts    # Project table columns
npx tsx server/seed-projects-qb.ts    # Import projects from Excel
npx tsx server/migrate-changelog.ts   # Changelog table
npx tsx server/seed-capacity-test.ts  # Optional: test data
```

---

## GitHub Setup (Already Done)

Your remote is configured:
```
origin  https://github.com/andrebadenhorst/sar-engineering-tools.git
```

### If You Need to Clone on a New Machine

```bash
git clone https://github.com/andrebadenhorst/sar-engineering-tools.git
cd sar-engineering-tools
npm install
npx tsx server/seed.ts          # Set up database
npm run dev                     # Start development
```

### Branches

```bash
git branch                    # List branches
git checkout -b feature/xyz   # Create a new branch for a feature
git checkout master            # Switch back to master
git merge feature/xyz          # Merge feature into master
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Save & backup code | `git add -A && git commit -m "message" && git push` |
| Check status | `git status` |
| View history | `git log --oneline -10` |
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Backup database | `cp data/sar-tools.db data/backups/sar-tools-DATE.db` |
| Restore database | `cp data/backups/FILE.db data/sar-tools.db` |
| Rebuild database | Run seed scripts (see above) |
| Install on new machine | `git clone URL && npm install && npx tsx server/seed.ts` |
