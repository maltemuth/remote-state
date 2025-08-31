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
  getInitialState: () => StateType;
  validateAction: (
    state: StateType,
    action: ActionType,
    playerId: string
  ) => ActionValidationResult;
  executeAction: (state: StateType, action: ActionType, playerId: string) => StateType;
  filterStateForPlayer?: (state: StateType, playerId: string) => StateType;
  gameConfig?: {
    name: string;
    description?: string;
  };
  serverConfiguration?: RemoteStateServerConfiguration;
}
