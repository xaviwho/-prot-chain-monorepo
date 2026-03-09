# ProtChain - Blockchain-Verified Proteomic Workflow Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org/)
[![Docker](https://img.shields.io/badge/Docker-Required-blue.svg)](https://docker.com/)

## 🧬 Overview

ProtChain is a government-grade, blockchain-verified protein structure analysis platform that combines cutting-edge bioinformatics with decentralized technology to ensure data integrity, provenance, and reproducibility in scientific research.

### 🎯 Key Features

- **Real-Time Protein Analysis** - Immediate structure processing via bioapi integration
- **Blockchain Provenance** - All results committed to PureChain for immutable verification
- **IPFS Storage** - Decentralized storage of analysis results and metadata
- **Professional Export** - CSV format ready for Excel and scientific analysis
- **Government Compliance** - Production-grade security and data integrity
- **Single-Click Workflow** - Streamlined user experience from upload to verification

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   BioAPI        │
│   (Next.js)     │◄──►│   (Go)          │◄──►│   (Python)      │
│                 │    │                 │    │                 │
│ • React UI      │    │ • REST API      │    │ • Structure     │
│ • Material-UI   │    │ • JWT Auth      │    │   Analysis      │
│ • CSV Export    │    │ • Workflow Mgmt │    │ • Molecular     │
│ • Real-time     │    │ • File Handling │    │   Descriptors   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
         │   PureChain     │    │   PostgreSQL    │    │   IPFS Node     │
         │   Blockchain    │    │   Database      │    │   Storage       │
         │                 │    │                 │    │                 │
         │ • Smart         │    │ • Workflows     │    │ • Results       │
         │   Contracts     │    │ • Users         │    │ • Metadata      │
         │ • Verification  │    │ • Run History   │    │ • Provenance    │
         │ • Provenance    │    │ • Auth Tokens   │    │ • Decentralized │
         └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** - For containerized services
- **Node.js 18+** - For frontend development
- **Go 1.21+** - For backend API
- **Python 3.11+** - For bioapi services
- **Git** - For version control

### 1. Clone the Repository

```bash
git clone https://github.com/xaviwho/prot-chain.git
cd prot-chain
```

### 2. Environment Setup

Create environment files with your configuration:

```bash
# Root .env
HTTP_PORT=8082

# protchain/.env
DATABASE_URL="postgres://postgres:mysecretpassword@db:5432/protchain?sslmode=disable"
BIO_API_URL="http://bio-api:8000/api/v1"
IPFS_ADDRESS="/ip4/0.0.0.0/tcp/5001"
JWT_KEY="your-jwt-secret"

# PureChain Configuration
PURECHAIN_RPC_URL="https://purechainnode.com"
PURECHAIN_ID="900520900520"

# Smart Contract Addresses
WORKFLOW_CONTRACT_ADDRESS="0xAA3DFc054293Dd3731892A1Ba0366D6e6FB1Ee51"
SIGNER_PRIVATE_KEY="your-private-key"

# protchain-ui/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
WORKFLOW_TRACKER_ADDRESS=0xAA3DFc054293Dd3731892A1Ba0366D6e6FB1Ee51
PRIVATE_KEY=your-private-key
```

### 3. Start Backend Services

```bash
# Start all backend services (PostgreSQL, BioAPI, IPFS, Go API)
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 4. Start Frontend

```bash
cd protchain-ui
npm install
npm run dev
```

### 5. Access the Platform

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8082
- **BioAPI**: http://localhost:8000
- **IPFS Gateway**: http://localhost:8080

## 📋 Usage Guide

### Creating a Workflow

1. **Navigate** to the platform at http://localhost:3000
2. **Register/Login** with your credentials
3. **Create New Workflow** from the dashboard
4. **Enter workflow details** (name, description, parameters)

### Processing Protein Structures

1. **Open a workflow** from your dashboard
2. **Click "Search and Process Structure"**
3. **Upload PDB file** or **enter PDB ID** (e.g., "1ABC")
4. **View results immediately** - no waiting or page reloads needed

### Exporting Results

1. **After structure processing** completes
2. **Click "Download Results"** button
3. **Receive CSV file** with:
   - Molecular descriptors (atoms, residues, chains)
   - Molecular weight and properties
   - Bond and ring counts
   - Professional metadata

### Blockchain Verification

1. **Click "Commit to Blockchain"** after viewing results
2. **Wait for IPFS upload** (decentralized storage)
3. **Receive PureChain transaction hash** (immutable proof)
4. **Click "Verify"** to check blockchain integrity

## 🔧 Development

### Project Structure

```
prot-chain-monorepo/
├── protchain/              # Go backend API
│   ├── cmd/               # Application entry points
│   ├── internal/          # Internal packages
│   │   ├── dal/          # Data access layer
│   │   ├── restapi/      # REST API handlers
│   │   └── value/        # Value objects
│   └── pkg/              # Public packages
├── protchain-ui/          # Next.js frontend
│   ├── src/
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   └── utils/        # Utility functions
│   └── public/           # Static assets
├── bioapi/               # Python bioinformatics API
│   ├── src/              # Source code
│   ├── templates/        # Analysis templates
│   └── requirements.txt  # Python dependencies
├── docker-compose.yml    # Service orchestration
└── uploads/              # File storage
```

### Key Components

#### Frontend (Next.js + React)
- **WorkflowResults.js** - Displays analysis results with real-time updates
- **StructureUpload.js** - Handles PDB file/ID processing
- **WorkflowStages.js** - Multi-stage analysis pipeline UI

#### Backend (Go)
- **Workflow Management** - CRUD operations for scientific workflows
- **Authentication** - JWT-based user management
- **File Handling** - Secure upload and processing
- **Blockchain Integration** - PureChain smart contract interactions

#### BioAPI (Python)
- **Structure Analysis** - Real protein structure processing
- **Molecular Descriptors** - Comprehensive molecular property calculation
- **Template System** - Configurable analysis workflows

### Running Tests

```bash
# Backend tests
cd protchain
go test ./...

# Frontend tests
cd protchain-ui
npm test

# BioAPI tests
cd bioapi
python -m pytest
```

## 🔐 Security & Compliance

### Government-Grade Features

- **Immutable Provenance** - All results stored on PureChain blockchain
- **Decentralized Storage** - IPFS ensures data availability
- **Cryptographic Verification** - Smart contract-based integrity checks
- **Audit Trail** - Complete workflow history and run tracking
- **No Mock Data** - Production-ready real analysis only

### Data Integrity

- **Blockchain Commits** - Every analysis result gets a unique transaction hash
- **IPFS Hashing** - Content-addressed storage prevents tampering
- **Smart Contract Verification** - Automated integrity checking
- **CSV Export** - Professional format for regulatory compliance

## 🌐 Blockchain Integration

### PureChain Network

- **RPC URL**: https://purechainnode.com
- **Chain ID**: 900520900520
- **Smart Contract**: WorkflowTracker at `0xAA3DFc054293Dd3731892A1Ba0366D6e6FB1Ee51`

### Smart Contract Functions

```solidity
// Commit analysis results to blockchain
function commitResults(
    string workflowId,
    string stage,
    string ipfsHash,
    string resultsHash
) external

// Verify results integrity
function getWorkflowResults(string workflowId) 
    external view returns (
        string stage,
        string ipfsHash,
        string resultsHash,
        uint256 timestamp
    )
```

## 📊 API Documentation

### REST Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication

#### Workflows
- `GET /api/v1/workflows` - List user workflows
- `POST /api/v1/workflows` - Create new workflow
- `GET /api/v1/workflows/{id}` - Get workflow details
- `DELETE /api/v1/workflows/{id}` - Delete workflow

#### Structure Analysis
- `POST /api/workflow/{id}/structure` - Process protein structure
- `GET /api/workflow/{id}/refresh-results` - Get analysis results

#### Blockchain & IPFS
- `POST /api/ipfs/upload` - Upload results to IPFS
- `POST /api/blockchain/commit-results` - Commit to PureChain
- `POST /api/blockchain/verify-results` - Verify blockchain integrity

## 🐳 Docker Services

### Service Configuration

```yaml
services:
  db:          # PostgreSQL database
  protchain-api: # Go backend API
  bio-api:     # Python bioinformatics API
  ipfs:        # IPFS storage node
```

### Health Checks

```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Restart services
docker-compose restart [service-name]
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- **Follow Go standards** for backend code
- **Use TypeScript** for frontend components
- **Write tests** for new features
- **Update documentation** for API changes
- **Ensure blockchain integration** works with test networks

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PureChain Network** - Blockchain infrastructure
- **IPFS Protocol** - Decentralized storage
- **Material-UI** - React component library
- **Next.js** - React framework
- **Go Gin** - Web framework
- **PostgreSQL** - Database system

## 📞 Support

For support and questions:

- **Issues**: [GitHub Issues](https://github.com/xaviwho/prot-chain/issues)
- **Documentation**: [Project Wiki](https://github.com/xaviwho/prot-chain/wiki)
- **Email**: support@protchain.org

---

**ProtChain** - Advancing scientific research through blockchain-verified bioinformatics.
