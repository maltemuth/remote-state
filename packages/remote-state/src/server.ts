/**
 * Main server file for the Remote State library
 * This file demonstrates how to create and start a server using the library
 *
 * Note: Game-specific logic has been moved to the remote-state-example-server package
 * This file serves as a generic example that can be adapted for different games
 */

import { createRemoteStateServer } from './index';
import { createLogger } from './logger';

const { info } = createLogger({
  scope: 'main-server',
});

// Generic server example - game-specific implementations should be in example servers
// For a working example, see the remote-state-example-server package

info('Remote State library server example');
info('For a complete implementation, check the remote-state-example-server package');

// Export the createRemoteStateServer function for use in other projects
export { createRemoteStateServer };
