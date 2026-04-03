import { matrixService } from '../core/matrix';

export const useMatrixClient = () => {
  return matrixService.getClient();
};
