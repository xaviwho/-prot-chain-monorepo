#!/bin/bash

# ProtChain Cloudflare Setup Script
# Run this script locally to configure Cloudflare DNS

set -e

echo "🌐 Setting up Cloudflare for ProtChain..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Get user inputs
echo ""
print_step "Please provide the following information:"
read -p "Enter your domain name (e.g., protchain.com): " DOMAIN
read -p "Enter your EC2 public IP address: " EC2_IP
read -p "Enter your Cloudflare API Token (optional, for automation): " CF_TOKEN
read -p "Enter your Cloudflare Zone ID (optional, for automation): " ZONE_ID

echo ""
print_status "Domain: $DOMAIN"
print_status "EC2 IP: $EC2_IP"
echo ""

# Manual setup instructions
print_step "STEP 1: Add Domain to Cloudflare"
echo "1. Go to https://dash.cloudflare.com"
echo "2. Click 'Add a Site'"
echo "3. Enter your domain: $DOMAIN"
echo "4. Choose the Free plan"
echo "5. Cloudflare will scan your existing DNS records"
echo ""
read -p "Press Enter when you've completed Step 1..."

print_step "STEP 2: Update Nameservers"
echo "1. In Cloudflare, note the nameservers (usually name1.cloudflare.com and name2.cloudflare.com)"
echo "2. Go to your domain registrar (GoDaddy, Namecheap, etc.)"
echo "3. Update nameservers to Cloudflare's nameservers"
echo "4. Wait for DNS propagation (can take up to 24 hours)"
echo ""
read -p "Press Enter when you've completed Step 2..."

print_step "STEP 3: Configure DNS Records"
echo "In Cloudflare DNS settings, add these records:"
echo ""
echo "Type    Name    Content         Proxy Status"
echo "A       @       $EC2_IP        Proxied (🧡)"
echo "A       www     $EC2_IP        Proxied (🧡)"
echo "A       api     $EC2_IP        Proxied (🧡)"
echo ""
echo "Make sure the orange cloud is enabled (Proxied) for all records!"
echo ""
read -p "Press Enter when you've added the DNS records..."

print_step "STEP 4: SSL/TLS Configuration"
echo "1. Go to SSL/TLS → Overview"
echo "2. Set encryption mode to 'Full (strict)'"
echo "3. Go to SSL/TLS → Edge Certificates"
echo "4. Enable 'Always Use HTTPS'"
echo "5. Enable 'HTTP Strict Transport Security (HSTS)'"
echo ""
read -p "Press Enter when you've configured SSL/TLS..."

print_step "STEP 5: Performance Optimization"
echo "1. Go to Speed → Optimization"
echo "2. Enable Auto Minify for CSS, JavaScript, and HTML"
echo "3. Enable Brotli compression"
echo "4. Go to Caching → Configuration"
echo "5. Set Browser Cache TTL to '1 month'"
echo ""
read -p "Press Enter when you've configured performance settings..."

print_step "STEP 6: Security Settings"
echo "1. Go to Security → Settings"
echo "2. Set Security Level to 'Medium'"
echo "3. Go to Security → WAF"
echo "4. Enable 'Cloudflare Managed Ruleset'"
echo "5. Go to Scrape Shield"
echo "6. Enable 'Email Address Obfuscation' and 'Server-side Excludes'"
echo ""
read -p "Press Enter when you've configured security settings..."

# If API token provided, automate some settings
if [ ! -z "$CF_TOKEN" ] && [ ! -z "$ZONE_ID" ]; then
    print_step "STEP 7: Automated Configuration (Optional)"
    
    # Check if curl is available
    if command -v curl &> /dev/null; then
        print_status "Attempting to configure some settings automatically..."
        
        # Enable Always Use HTTPS
        curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/always_use_https" \
             -H "Authorization: Bearer $CF_TOKEN" \
             -H "Content-Type: application/json" \
             --data '{"value":"on"}' \
             --silent > /dev/null && print_status "✅ Always Use HTTPS enabled" || print_warning "⚠️  Could not enable Always Use HTTPS"
        
        # Enable Brotli
        curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/brotli" \
             -H "Authorization: Bearer $CF_TOKEN" \
             -H "Content-Type: application/json" \
             --data '{"value":"on"}' \
             --silent > /dev/null && print_status "✅ Brotli compression enabled" || print_warning "⚠️  Could not enable Brotli"
        
        # Set minimum TLS version
        curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/min_tls_version" \
             -H "Authorization: Bearer $CF_TOKEN" \
             -H "Content-Type: application/json" \
             --data '{"value":"1.2"}' \
             --silent > /dev/null && print_status "✅ Minimum TLS version set to 1.2" || print_warning "⚠️  Could not set minimum TLS version"
    else
        print_warning "curl not found, skipping automated configuration"
    fi
fi

# Create monitoring script
print_step "STEP 8: Creating Monitoring Script"
cat > monitor-site.sh << EOF
#!/bin/bash

# ProtChain Site Monitoring Script

DOMAIN="$DOMAIN"
EC2_IP="$EC2_IP"

echo "🔍 Monitoring ProtChain deployment..."

# Check DNS resolution
echo "DNS Resolution:"
nslookup \$DOMAIN
echo ""

# Check HTTP response
echo "HTTP Response:"
curl -I https://\$DOMAIN 2>/dev/null | head -n 1
echo ""

# Check API endpoint
echo "API Health Check:"
curl -s https://\$DOMAIN/api/health 2>/dev/null || echo "API not responding"
echo ""

# Check SSL certificate
echo "SSL Certificate:"
echo | openssl s_client -servername \$DOMAIN -connect \$DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
echo ""

# Check Cloudflare status
echo "Cloudflare Status:"
curl -s -H "CF-Connecting-IP: test" https://\$DOMAIN 2>/dev/null | grep -q "cf-ray" && echo "✅ Cloudflare is active" || echo "❌ Cloudflare not detected"
EOF

chmod +x monitor-site.sh

# Final instructions
echo ""
print_status "🎉 Cloudflare setup guide completed!"
echo ""
print_status "Next steps:"
echo "1. Wait for DNS propagation (check with: nslookup $DOMAIN)"
echo "2. Test your site: https://$DOMAIN"
echo "3. Run monitoring script: ./monitor-site.sh"
echo "4. Check Cloudflare Analytics dashboard"
echo ""
print_warning "Important notes:"
print_warning "- DNS propagation can take up to 24 hours"
print_warning "- Make sure your EC2 security groups allow HTTP (80) and HTTPS (443)"
print_warning "- Monitor Cloudflare Analytics for traffic and security insights"
echo ""
print_status "Useful Cloudflare URLs:"
echo "📊 Analytics: https://dash.cloudflare.com/analytics"
echo "🔧 DNS: https://dash.cloudflare.com/dns"
echo "🛡️  Security: https://dash.cloudflare.com/security"
echo "⚡ Speed: https://dash.cloudflare.com/speed"
