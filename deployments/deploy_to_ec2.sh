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
docker build -t "$API_IMAGE" -f ./Dockerfile.prod
docker push "$API_IMAGE"
cd ..

# build biapi image
cd bioapi/ || exit
docker build -t "$BIOAPI_IMAGE" -f ./Dockerfile.prod
docker push "$BIOAPI_IMAGE"

# ssh into ec2 interactively
echo "🔑 Enter path to your EC2 keypair (.pem):"
read -r KEY_PATH

# move back to deployments folder
cd ../deployments/ || exit

# securely copy the docker-compose file
scp -i "$KEY_PATH" docker-compose.yml ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com:/

# ssh into instance
ssh -i "$KEY_PATH" ubuntu@ec2-13-124-243-4.ap-northeast-2.compute.amazonaws.com <<EOF
  echo "Starting automation script on EC2 instance..."

  # Install Docker
  sudo apt-get update
  sudo apt-get install docker.io -y
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker ubuntu
  echo "Docker has been installed and started."

  # Install Docker Compose
  sudo apt-get install docker-compose -y
  echo "Docker Compose has been installed."

  # Navigate to the project directory and run docker-compose
  cd "$PROJECT_DIR"
  docker-compose up -d
  echo "Docker Compose services have been started."

  echo "Automation script finished."
EOF
