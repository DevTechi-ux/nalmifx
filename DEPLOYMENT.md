# NalmiFX VPS Deployment Guide

## Prerequisites
- Node.js 18+ installed on VPS
- MongoDB installed on VPS or MongoDB Atlas connection
- PM2 for process management: `npm install -g pm2`

## Step 1: Upload Project to VPS

Upload the entire project folder to your VPS using SCP, SFTP, or Git.

```bash
# Using SCP (from local machine)
scp -r ./nalmi user@YOUR_VPS_IP:/home/user/nalmi

# Or clone from Git
git clone YOUR_REPO_URL /home/user/nalmi
```

## Step 2: Configure Backend

```bash
cd /home/user/nalmi/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

Edit `.env` with your production values:
```env
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/nalmifx
JWT_SECRET=your_secure_random_string_here
CORS_ORIGIN=http://YOUR_VPS_IP:5173
```

## Step 3: Configure Frontend

```bash
cd /home/user/nalmi/frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
nano .env
```

Edit `.env` with your VPS IP:
```env
VITE_API_URL=http://YOUR_VPS_IP:5001
```

## Step 4: Build Frontend

```bash
cd /home/user/nalmi/frontend
npm run build
```

## Step 5: Start Backend with PM2

```bash
cd /home/user/nalmi/backend

# Start with PM2
pm2 start server.js --name nalmifx-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Step 6: Serve Frontend

### Option A: Using serve (Simple)
```bash
npm install -g serve
cd /home/user/nalmi/frontend
pm2 start "serve -s dist -l 5173" --name nalmifx-frontend
```

### Option B: Using Nginx (Recommended for Production)
```bash
sudo apt install nginx

# Configure nginx
sudo nano /etc/nginx/sites-available/nalmifx
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name YOUR_VPS_IP;
    
    # Frontend
    location / {
        root /home/user/nalmi/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket for real-time prices
    location /socket.io {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nalmifx /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 7: Configure Firewall

```bash
# Allow required ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS (if using SSL)
sudo ufw allow 5001  # Backend API (if not using nginx proxy)
sudo ufw allow 5173  # Frontend (if not using nginx)
sudo ufw enable
```

## Step 8: Access Your Application

- Frontend: `http://YOUR_VPS_IP` (with nginx) or `http://YOUR_VPS_IP:5173`
- Backend API: `http://YOUR_VPS_IP:5001/api`

## Useful PM2 Commands

```bash
pm2 status              # Check status
pm2 logs                # View logs
pm2 restart all         # Restart all apps
pm2 stop nalmifx-backend   # Stop backend
pm2 delete nalmifx-backend # Remove from PM2
```

## Troubleshooting

### Backend not connecting to MongoDB
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

### Frontend can't reach backend
1. Check CORS settings in backend
2. Verify firewall allows port 5001
3. Check VITE_API_URL in frontend .env

### View logs
```bash
pm2 logs nalmifx-backend --lines 100
```

## Adding Domain Later

When you add a domain:

1. Update DNS A record to point to VPS IP
2. Update frontend `.env`:
   ```env
   VITE_API_URL=https://api.yourdomain.com
   ```
3. Update backend CORS:
   ```env
   CORS_ORIGIN=https://yourdomain.com
   ```
4. Rebuild frontend: `npm run build`
5. Configure SSL with Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
