import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeProvider();
    await this.loadContracts();
  }

  private async initializeProvider() {
    const rpcUrl = this.configService.get('BNB_RPC_URL');
    const privateKey = this.configService.get('PRIVATE_KEY');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    const network = await this.provider.getNetwork();
    this.logger.log(`Connected to network: ${network.name} (${network.chainId})`);

    const balance = await this.provider.getBalance(this.wallet.address);
    this.logger.log(`Wallet balance: ${ethers.formatEther(balance)} BNB`);
  }

  private async loadContracts() {
    const contracts = {
      oracleRegistry: {
        address: this.configService.get('ORACLE_REGISTRY_ADDRESS'),
        abi: this.getOracleRegistryABI(),
      },
      stakingManager: {
        address: this.configService.get('STAKING_MANAGER_ADDRESS'),
        abi: this.getStakingManagerABI(),
      },
      proposalManager: {
        address: this.configService.get('PROPOSAL_MANAGER_ADDRESS'),
        abi: this.getProposalManagerABI(),
      },
    };

    for (const [name, config] of Object.entries(contracts)) {
      const contract = new ethers.Contract(config.address, config.abi, this.wallet);
      this.contracts.set(name, contract);
      this.logger.log(`Loaded contract: ${name} at ${config.address}`);
    }
  }

  async submitProposal(eventId: string, proposalData: any): Promise<any> {
    try {
      const contract = this.contracts.get('proposalManager');
      if (!contract) throw new Error('Proposal contract not loaded');

      const proposalId = ethers.id(`${eventId}_${Date.now()}`);
      const outcomeHash = ethers.id(JSON.stringify(proposalData.outcome));

      const tx = await contract.submitProposal(
        proposalId,
        ethers.id(eventId),
        outcomeHash,
        ethers.toUtf8Bytes(JSON.stringify(proposalData.outcome)),
        proposalData.confidenceScore,
        proposalData.evidenceUri,
        { value: proposalData.bondAmount },
      );

      const receipt = await tx.wait();

      this.logger.log(`Proposal submitted: ${proposalId}, tx: ${receipt.hash}`);

      return {
        proposalId,
        transactionHash: receipt.hash,
        livenessExpiry: Date.now() + 2 * 60 * 60 * 1000,
      };
    } catch (error) {
      this.logger.error(`Failed to submit proposal: ${error.message}`);
      throw error;
    }
  }

  async finalizeProposal(proposalId: string): Promise<string> {
    try {
      const contract = this.contracts.get('proposalManager');
      if (!contract) throw new Error('Proposal contract not loaded');

      const tx = await contract.finalizeProposal(proposalId);
      const receipt = await tx.wait();

      this.logger.log(`Proposal finalized: ${proposalId}, tx: ${receipt.hash}`);

      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to finalize proposal: ${error.message}`);
      throw error;
    }
  }

  async settleEvent(eventId: string): Promise<string> {
    try {
      const contract = this.contracts.get('oracleRegistry');
      if (!contract) throw new Error('Oracle registry not loaded');

      const eventIdBytes = ethers.id(eventId);

      const tx = await contract.settleEvent(eventIdBytes);
      const receipt = await tx.wait();

      this.logger.log(`Event settled: ${eventId}, tx: ${receipt.hash}`);

      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to settle event: ${error.message}`);
      throw error;
    }
  }

  async getEventData(eventId: string): Promise<any> {
    try {
      const contract = this.contracts.get('oracleRegistry');
      if (!contract) throw new Error('Oracle registry not loaded');

      const eventIdBytes = ethers.id(eventId);
      const eventData = await contract.getEvent(eventIdBytes);

      return {
        eventId: eventData.eventId,
        description: eventData.description,
        status: eventData.status,
        confidenceScore: eventData.confidenceScore,
        proposer: eventData.proposer,
        disputeCount: eventData.disputeCount,
      };
    } catch (error) {
      this.logger.error(`Failed to get event data: ${error.message}`);
      throw error;
    }
  }

  getContract(name: string): ethers.Contract | undefined {
    return this.contracts.get(name);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getWallet(): ethers.Wallet {
    return this.wallet;
  }

  private getOracleRegistryABI(): any[] {
    return [
      'function createEvent(bytes32 eventId, string description, uint256 resolutionTime) external',
      'function getEvent(bytes32 eventId) external view returns (tuple(bytes32 eventId, string description, uint256 createdAt, uint256 resolutionTime, uint8 status, bytes32 outcomeHash, bytes outcome, uint256 confidenceScore, address proposer, uint256 proposerBond, uint256 disputeCount, string evidenceURI, uint256 rewardPool, bool settled))',
      'function settleEvent(bytes32 eventId) external',
      'event EventCreated(bytes32 indexed eventId, string description, uint256 resolutionTime)',
      'event EventSettled(bytes32 indexed eventId, uint256 totalPayout)',
    ];
  }

  private getStakingManagerABI(): any[] {
    return [
      'function stake() external payable',
      'function unstake(uint256 amount) external',
      'function getStake(address staker) external view returns (tuple(uint256 amount, uint256 stakedAt, uint256 lastRewardClaim, uint256 lockPeriod, bool active))',
    ];
  }

  private getProposalManagerABI(): any[] {
    return [
      'function submitProposal(bytes32 proposalId, bytes32 eventId, bytes32 outcomeHash, bytes outcome, uint256 confidenceScore, string evidenceURI) external payable returns (bytes32)',
      'function finalizeProposal(bytes32 proposalId) external',
      'function getProposal(bytes32 proposalId) external view returns (tuple(bytes32 proposalId, bytes32 eventId, address proposer, bytes32 outcomeHash, bytes outcome, uint256 confidenceScore, string evidenceURI, uint256 bondAmount, uint256 submittedAt, uint256 livenessExpiry, uint256 finalizedAt, uint8 status, uint256 challengeCount, bool executed))',
      'event ProposalSubmitted(bytes32 indexed proposalId, bytes32 indexed eventId, address indexed proposer, uint256 bondAmount)',
      'event ProposalFinalized(bytes32 indexed proposalId, uint8 status)',
    ];
  }
}
