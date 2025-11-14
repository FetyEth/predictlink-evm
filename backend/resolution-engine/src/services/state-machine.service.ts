import { Injectable, Logger } from '@nestjs/common';

interface StateTransition {
  from: string[];
  to: string;
  condition?: (context: any) => boolean;
  action?: (context: any) => Promise<void>;
}

@Injectable()
export class StateMachineService {
  private readonly logger = new Logger(StateMachineService.name);

  private transitions: Map<string, StateTransition[]> = new Map([
    ['created', [
      { from: ['created'], to: 'detecting' },
      { from: ['created'], to: 'evidence_gathering' },
    ]],
    ['detecting', [
      { from: ['detecting'], to: 'proposing' },
      { from: ['detecting'], to: 'evidence_gathering' },
    ]],
    ['proposing', [
      { from: ['proposing'], to: 'liveness' },
    ]],
    ['liveness', [
      { from: ['liveness'], to: 'disputed' },
      { from: ['liveness'], to: 'monitoring' },
      { from: ['liveness'], to: 'resolved' },
    ]],
    ['disputed', [
      { from: ['disputed'], to: 'arbitration' },
      { from: ['disputed'], to: 'liveness' },
    ]],
    ['arbitration', [
      { from: ['arbitration'], to: 'resolved' },
      { from: ['arbitration'], to: 'liveness' },
    ]],
    ['resolved', [
      { from: ['resolved'], to: 'settled' },
    ]],
  ]);

  async transition(context: any, targetState: string): Promise<void> {
    const currentState = context.currentState;
    const validTransitions = this.transitions.get(targetState) || [];

    const transition = validTransitions.find((t) => t.from.includes(currentState));

    if (!transition) {
      throw new Error(`Invalid transition from ${currentState} to ${targetState}`);
    }

    if (transition.condition && !transition.condition(context)) {
      throw new Error(`Transition condition not met: ${currentState} -> ${targetState}`);
    }

    if (transition.action) {
      await transition.action(context);
    }

    context.currentState = targetState;
    this.logger.log(`State transition: ${currentState} -> ${targetState}`);
  }

  canTransition(currentState: string, targetState: string): boolean {
    const validTransitions = this.transitions.get(targetState) || [];
    return validTransitions.some((t) => t.from.includes(currentState));
  }
}
