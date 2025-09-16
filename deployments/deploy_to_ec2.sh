#NOTE: assumes you are running the script from the script's directory

# build and push protchain and bioapi update to dockerhub
# ssh into ec2 instance
# rebuild docker-compoose

# image names
API_IMAGE="xaviwho/protchain:latest"
BIOAPI_IMAGE="xaviwho/bioapi:latest"

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

# ssh into ec2 interactively
echo "$(pwd)"
echo "🔑 Enter path to your EC2 keypair (.pem):"
read -r KEY_PATH


# move back to deployments folder
cd ../deployments/ || exit

# securely copy the docker-compose file
echo "$KEY_PATH"
sudo scp -i "$KEY_PATH" docker-compose.yml ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com:~/docker-compose.yml
echo "copied file to ec2"

# SSH into EC2 instance and run automation
ssh -i "$KEY_PATH" ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com << 'EOF'
  echo "Starting automation script on EC2 instance..."
  
  # Update package list
  sudo apt-get update -y
  
  # Install Docker
  echo "Installing Docker..."
  sudo apt-get install docker.io -y
  sudo systemctl start docker
  sudo systemctl enable docker
  
  # Install Docker Compose
  echo "Installing Docker Compose..."
  sudo apt-get install docker-compose -y
  
  # Add user to docker group (will take effect on next login)
  sudo usermod -aG docker ubuntu
  echo "Docker and Docker Compose installed successfully."
  
  # Start Docker Compose services
  echo "Starting Docker Compose services..."
  sudo docker-compose up -d
  
  # Show running containers
  echo "Running containers:"
  sudo docker ps
  
  echo "Automation script completed successfully!"
EOF
