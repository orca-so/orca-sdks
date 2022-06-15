export type ZPTokenData = {
  mint: string;
  name: string;
  symbol: string;
  logoURI: string;
  whitelisted: boolean;
  coingeckoId?: string;
  ftxId?: string;
};

export type ZPPoolData = {
  address: string;
  whitelisted: boolean;
  tokenMintA: string;
  tokenMintB: string;
  price: number;
  lpsFeeRate: number;
  protocolFeeRate: number;

  priceHistory?: DayWeekMonthData<MinMax>;
  tokenAPriceUSD?: ZPTokenPriceInfo;
  tokenBPriceUSD?: ZPTokenPriceInfo;
  tvl?: number;
  volume?: DayWeekMonthData<number>;
  feeApr?: DayWeekMonthData<number>;
  reward0Apr?: DayWeekMonthData<number>;
  reward1Apr?: DayWeekMonthData<number>;
  reward2Apr?: DayWeekMonthData<number>;
  totalApr?: DayWeekMonthData<number>;
};

export type ZPTokenPriceInfo = {
  price?: number;
  dex?: number;
  coingecko?: number;
};

export interface DayWeekMonthData<T> {
  day: T;
  week: T;
  month: T;
}

export type MinMax = {
  min: number;
  max: number;
};
