import Mux from '@mux/mux-node';

let mux: Mux | null = null;

export function getMuxApi() {
  if (mux) {
    return mux;
  }

  const { MUX_TOKEN_ID, MUX_TOKEN_SECRET } = process.env;

  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    throw new Error('Mux API credentials are not set in the environment.');
  }

  mux = new Mux(MUX_TOKEN_ID, MUX_TOKEN_SECRET);

  return mux;
}
