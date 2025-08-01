# ProtChain AWS EC2 + Cloudflare Deployment Guide

This guide helps you deploy ProtChain to AWS EC2 with Cloudflare for domain management.

## 🚀 Quick Start

### Prerequisites
- AWS EC2 instance (Ubuntu 22.04 LTS, t3.medium or larger)
- Domain name registered
- Cloudflare account

### 1. EC2 Instance Setup

**Launch EC2 Instance:**
- AMI: Ubuntu 22.04 LTS
- Instance Type: t3.medium (minimum)
- Storage: 20-50 GB SSD
- Security Group: Allow ports 22, 80, 443

**Security Group Rules:**
```
Type        Protocol    Port Range    Source
SSH         TCP         22           Your IP
HTTP        TCP         80           0.0.0.0/0
HTTPS       TCP         443          0.0.0.0/0
```

### 2. Deploy to EC2

**Connect to your EC2 instance:**
```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

**Upload and run deployment script:**
```bash
# Upload the repository to EC2
git clone https://github.com/xaviwho/prot-chain-monorepo.git
cd prot-chain-monorepo

# Make deployment script executable
chmod +x deploy-to-ec2.sh

# Run deployment script
./deploy-to-ec2.sh
```

**The script will:**
- Install Docker and Docker Compose
- Set up SSL certificates with Let's Encrypt
- Configure Nginx reverse proxy
- Build and start all services
- Set up automatic backups and certificate renewal

### 3. Configure Environment

**Edit the production environment file:**
```bash
nano .env
```

**Update these values:**
```env
# Change these values
POSTGRES_PASSWORD=your_secure_database_password_here
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters_long
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
DOMAIN=yourdomain.com
WWW_DOMAIN=www.yourdomain.com
```

### 4. Cloudflare Setup

**Run the Cloudflare setup script locally:**
```bash
# On your local machine (Windows bash)
chmod +x setup-cloudflare.sh
./setup-cloudflare.sh
```

**Manual Cloudflare Steps:**
1. Add your domain to Cloudflare
2. Update nameservers at your registrar
3. Add DNS records pointing to your EC2 IP
4. Configure SSL/TLS settings
5. Enable performance optimizations

## 📋 DNS Records for Cloudflare

Add these records in Cloudflare DNS:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | @ | YOUR_EC2_IP | Proxied 🧡 |
| A | www | YOUR_EC2_IP | Proxied 🧡 |
| A | api | YOUR_EC2_IP | Proxied 🧡 |

## 🔧 Management Commands

**View service status:**
```bash
docker-compose -f docker-compose.prod.yml ps
```

**View logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

**Restart services:**
```bash
docker-compose -f docker-compose.prod.yml restart
```

**Update application:**
```bash
git pull origin master
docker-compose -f docker-compose.prod.yml up -d --build
```

**Manual backup:**
```bash
./backup.sh
```

## 🛡️ Security Features

- SSL/TLS encryption with automatic renewal
- Nginx rate limiting
- Security headers
- Cloudflare DDoS protection
- Non-root Docker containers
- Database password protection

## 📊 Monitoring

**Check site health:**
```bash
./monitor-site.sh
```

**View system resources:**
```bash
htop
docker stats
```

**Check SSL certificate:**
```bash
openssl s_client -servername yourdomain.com -connect yourdomain.com:443
```

## 🔄 Automatic Tasks

The deployment sets up:
- **Daily database backups** (2 AM)
- **SSL certificate renewal** (12 PM daily)
- **Log rotation**
- **Health checks**

## 💰 Estimated Costs

- **EC2 t3.medium**: ~$30/month
- **EBS Storage (50GB)**: ~$5/month
- **Cloudflare**: Free
- **Domain**: $10-15/year
- **Total**: ~$35-40/month

## 🆘 Troubleshooting

**Common Issues:**

1. **Services not starting:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs
   ```

2. **SSL certificate issues:**
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

3. **Database connection issues:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec postgres psql -U protchain -d protchain_prod
   ```

4. **Nginx configuration test:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec nginx nginx -t
   ```

## 📞 Support

- Check logs first: `docker-compose -f docker-compose.prod.yml logs -f`
- Verify environment variables in `.env`
- Ensure security groups allow required ports
- Check Cloudflare DNS propagation

## 🎯 Post-Deployment Checklist

- [ ] EC2 instance running
- [ ] All Docker services healthy
- [ ] SSL certificates valid
- [ ] Domain resolving to EC2 IP
- [ ] Cloudflare proxy enabled
- [ ] Application accessible via HTTPS
- [ ] API endpoints responding
- [ ] Database backups working
- [ ] Monitoring scripts functional
