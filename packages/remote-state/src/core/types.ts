import { RemoteStateServerConfiguration } from './server';

export interface SocketIOServerConfiguration {
  enabled?: boolean;
  cors?: {
    origin: string | string[];
    methods: string[];
  };
}

export type ActionValidationResult = true | string;

export interface GamePlugin<StateType, ActionType> {
  getInitialState: () => Promise<StateType>;
  validateAction: (
    state: StateType,
    action: ActionType,
    playerId: string
  ) => Promise<ActionValidationResult>;
  executeAction: (state: StateType, action: ActionType, playerId: string) => Promise<StateType>;
  filterStateForPlayer?: (state: StateType, playerId: string) => Promise<StateType>;
  gameConfig?: {
    name: string;
    description?: string;
  };
  serverConfiguration?: RemoteStateServerConfiguration;
}
