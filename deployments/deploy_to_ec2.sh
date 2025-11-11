#NOTE: assumes you are running the script from the script's directory

# build and push protchain and bioapi update to dockerhub
# ssh into ec2 instance
# rebuild docker-compoose

# image names
API_IMAGE="xaviwho/protchain:latest"
BIOAPI_IMAGE="xaviwho/bioapi:latest"
FRONTEND_IMAGE="xaviwho/protchain-ui:latest"

# handle docker login
docker login

# build server api image
cd ../protchain/ || exit
docker build -t "$API_IMAGE" -f ./Dockerfile.prod .
docker push "$API_IMAGE"
cd ..

# build biapi image
cd bioapi/ || exit
docker build -t "$BIOAPI_IMAGE" -f ./Dockerfile.prod .
docker push "$BIOAPI_IMAGE"
cd ..

# build frontend image
cd protchain-ui/ || exit
docker build -t "$FRONTEND_IMAGE" -f ./Dockerfile.prod --build-arg NEXT_PUBLIC_API_URL=http://ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com:8082/api/v1 .
docker push "$FRONTEND_IMAGE"

# ssh into ec2 interactively
echo "$(pwd)"
echo "🔑 Enter path to your EC2 keypair (.pem):"
read -r KEY_PATH


# move back to deployments folder
cd ../deployments/ || exit

# securely copy the docker-compose file and environment
echo "$KEY_PATH"
sudo scp -i "$KEY_PATH" docker-compose.yml ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com:~/docker-compose.yml
sudo scp -i "$KEY_PATH" ../.env.prod ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com:~/.env
echo "copied production files to ec2"

# SSH into EC2 instance and run automation
ssh -i "$KEY_PATH" ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com << 'EOF'
  echo "Starting automation script on EC2 instance..."
  
  # Update package list
  sudo apt-get update -y
  
  # Install Docker (non-interactive)
  echo "Installing Docker..."
  export DEBIAN_FRONTEND=noninteractive
  sudo -E apt-get install docker.io -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
  sudo systemctl start docker
  sudo systemctl enable docker
  
  # Install Docker Compose
  echo "Installing Docker Compose..."
  sudo -E apt-get install docker-compose -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
  
  # Add user to docker group (will take effect on next login)
  sudo usermod -aG docker ubuntu
  
  # Restart Docker daemon to ensure clean state
  echo "Restarting Docker daemon..."
  sudo systemctl restart docker
  sleep 5
  
  echo "Docker and Docker Compose installed successfully."
  
  # Stop any existing containers
  echo "Stopping existing containers..."
  sudo docker-compose down || true
  
  # Pull latest images
  echo "Pulling latest images..."
  sudo docker-compose pull
  
  # Start Docker Compose services
  echo "Starting Docker Compose services..."
  sudo docker-compose up -d
  
  # Show running containers
  echo "Running containers:"
  sudo docker ps
  
  # Show logs if there are issues
  echo "Checking service logs..."
  sudo docker-compose logs --tail=20
  
  echo "Automation script completed successfully!"
EOF
