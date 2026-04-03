import * as sdk from 'matrix-js-sdk';
import { matrixService } from '../core/matrix';

export const useMatrixClient = (): sdk.MatrixClient | null => {
  return matrixService.getClient();
};
