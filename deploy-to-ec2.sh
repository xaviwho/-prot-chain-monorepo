#!/bin/bash

# ProtChain AWS EC2 Deployment Script
# Run this script on your EC2 instance

set -e  # Exit on any error

echo "🚀 Starting ProtChain deployment to EC2..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_warning "Docker installed. You may need to log out and back in for group changes to take effect."
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Install other dependencies
print_status "Installing additional dependencies..."
sudo apt install -y git nginx certbot python3-certbot-nginx htop curl wget

# Clone or update repository
REPO_DIR="/home/$USER/prot-chain"
if [ -d "$REPO_DIR" ]; then
    print_status "Updating existing repository..."
    cd $REPO_DIR
    git pull origin master
else
    print_status "Cloning repository..."
    git clone https://github.com/xaviwho/prot-chain.git $REPO_DIR
    cd $REPO_DIR
fi

# Copy production environment file
if [ ! -f ".env" ]; then
    print_status "Setting up environment file..."
    cp .env.prod .env
    print_warning "Please edit .env file with your production values:"
    print_warning "- Update POSTGRES_PASSWORD"
    print_warning "- Update JWT_SECRET"
    print_warning "- Update domain names"
    print_warning "- Update NEXT_PUBLIC_API_URL"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
fi

# Create SSL directory
print_status "Creating SSL directory..."
mkdir -p nginx/ssl

# Get SSL certificates using Certbot
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
read -p "Enter your www domain (e.g., www.yourdomain.com): " WWW_DOMAIN

print_status "Obtaining SSL certificates..."
sudo certbot certonly --standalone -d $DOMAIN -d $WWW_DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Copy certificates
print_status "Copying SSL certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
sudo chown $USER:$USER nginx/ssl/*

# Update nginx configuration with actual domain
print_status "Updating nginx configuration..."
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/nginx.conf
sed -i "s/www.yourdomain.com/$WWW_DOMAIN/g" nginx/nginx.conf

# Build and start services
print_status "Building and starting services..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to start
print_status "Waiting for services to start..."
sleep 30

# Check service status
print_status "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

# Set up automatic certificate renewal
print_status "Setting up automatic certificate renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f $REPO_DIR/docker-compose.prod.yml restart nginx") | crontab -

# Create backup script
print_status "Creating backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
docker exec protchain-monorepo_postgres_1 pg_dump -U protchain protchain_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_backup_$DATE.sql"
EOF

chmod +x backup.sh

# Set up daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * $REPO_DIR/backup.sh") | crontab -

print_status "✅ Deployment completed successfully!"
echo ""
print_status "Your ProtChain application should now be running at:"
print_status "🌐 https://$DOMAIN"
print_status "🔧 API: https://$DOMAIN/api"
echo ""
print_status "Next steps:"
print_status "1. Configure Cloudflare DNS to point to this server"
print_status "2. Test your application"
print_status "3. Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
print_warning "Important files:"
print_warning "- Environment: $REPO_DIR/.env"
print_warning "- SSL Certificates: $REPO_DIR/nginx/ssl/"
print_warning "- Nginx Config: $REPO_DIR/nginx/nginx.conf"
print_warning "- Backups: /home/$USER/backups/"
