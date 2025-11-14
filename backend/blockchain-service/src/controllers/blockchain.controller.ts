import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BlockchainService } from '../services/blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private blockchainService: BlockchainService) {}

  @Get('balance')
  async getBalance() {
    const wallet = this.blockchainService.getWallet();
    const provider = this.blockchainService.getProvider();
    const balance = await provider.getBalance(wallet.address);

    return {
      address: wallet.address,
      balance: balance.toString(),
      balanceFormatted: balance.toString(),
    };
  }

  @Get('event/:id')
  async getEvent(@Param('id') id: string) {
    return await this.blockchainService.getEventData(id);
  }

  @Post('proposal/submit')
  async submitProposal(@Body() body: any) {
    return await this.blockchainService.submitProposal(body.eventId, body.proposalData);
  }
}