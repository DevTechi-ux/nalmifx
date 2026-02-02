# CI/CD Setup Guide for NalmiFX

This project uses GitHub Actions for automatic deployment to your VPS.

## Workflow Files

| File | Trigger | What it does |
|------|---------|--------------|
| `deploy.yml` | Push to main | Deploys both backend & frontend |
| `deploy-backend.yml` | Changes in `backend/` folder | Deploys backend only |
| `deploy-frontend.yml` | Changes in `frontend/` folder | Deploys frontend only |

## Setup Steps

### Step 1: Generate SSH Key on VPS

SSH into your VPS and run:

```bash
# Generate SSH key (if not already exists)
ssh-keygen -t ed25519 -C "github-actions"

# View the private key (you'll need this for GitHub)
cat ~/.ssh/id_ed25519

# Add public key to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

### Step 2: Add GitHub Secrets

Go to your GitHub repository:
1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `VPS_HOST` | Your VPS IP address (e.g., `123.45.67.89`) |
| `VPS_USER` | SSH username (e.g., `nalmifx`) |
| `VPS_PORT` | SSH port (usually `22`) |
| `VPS_SSH_KEY` | The entire private key from Step 1 (including `-----BEGIN...` and `-----END...`) |

### Step 3: Ensure VPS is Ready

Make sure your VPS has:
1. Git installed and repo cloned at `/home/nalmifx/nalmi`
2. PM2 installed globally
3. Node.js installed
4. The SSH key's public key in `~/.ssh/authorized_keys`

### Step 4: Test the Workflow

1. Push a change to the `main` branch
2. Go to GitHub → **Actions** tab
3. Watch the deployment run

## Manual Trigger

You can also manually trigger deployments:
1. Go to GitHub → **Actions**
2. Select the workflow
3. Click **Run workflow**

## Troubleshooting

### Deployment fails with "Permission denied"
- Check that the SSH key is correctly added to GitHub secrets
- Verify the public key is in `~/.ssh/authorized_keys` on VPS
- Check VPS_USER has correct permissions

### PM2 restart fails
- SSH into VPS and check: `pm2 status`
- Make sure the app name matches: `nalmifx-backend`

### Git pull fails
- SSH into VPS and run: `cd /home/nalmifx/nalmi && git status`
- Resolve any conflicts manually

## Logs

View deployment logs in GitHub Actions tab or on VPS:
```bash
pm2 logs nalmifx-backend --lines 50
```
