export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUrl: process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017/bv-invest',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  inviteToken: process.env.INVITE_TOKEN ?? 'dev-invite',
  isProd: process.env.NODE_ENV === 'production',
  coingeckoKey: process.env.COINGECKO_API_KEY || undefined,
  finnhubKey: process.env.FINNHUB_API_KEY || undefined,
  cookieName: 'bv_session',
  sessionDays: 30,
};
