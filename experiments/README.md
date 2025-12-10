# ProtChain Reviewer Experiments

This directory contains experiments and benchmarks conducted to address peer review comments for the PeerJ Computer Science paper:
**"ProtChain: A Blockchain-Enabled Framework for Secure and Reproducible Biomedical IoT Data Workflows"**

## Experiment Categories

### 1. Security / Adversarial Testing (Reviewer 1)
- **1A. Tampering Detection**: Demonstrates hash-based integrity verification via SHA-256 + on-chain records
- **1B. RBAC Enforcement**: Tests unauthorized access rejection via JWT/OAuth

### 2. Data Delivery Model (Reviewer 2)
- **2A. Event-Based Ingestion**: Validates discrete payload processing vs streaming claims

### 3. Energy Consumption Analysis (Reviewer 1)
- **3A. CPU/Time Comparison**: API-only vs API+blockchain overhead measurements

### 4. Multi-Validator Performance (Reviewer 1)
- **4A. Validator Scaling**: Performance with 1, 3, and 5 validators

## Running Experiments

```bash
# Install dependencies
cd experiments
npm install

# Run all experiments
npm run all

# Run individual experiments
npm run tampering      # 1A - Tampering detection
npm run auth           # 1B - RBAC enforcement
npm run energy         # 3A - Energy consumption
npm run validators     # 4  - Multi-validator
```

## Output

Results are saved to `experiments/results/` with timestamps for reproducibility.
Each experiment generates:
- JSON data files for analysis
- Summary reports for paper inclusion
- Console logs for debugging
