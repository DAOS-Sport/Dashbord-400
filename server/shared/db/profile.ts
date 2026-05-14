import { env, isRealDataMode } from "../config/env";

const MOCK_DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

export interface DatabaseRuntimeConfig {
  profile: typeof env.databaseProfile;
  connectionString: string;
  isMockConnection: boolean;
}

export const getDatabaseRuntimeConfig = (): DatabaseRuntimeConfig => {
  if (env.databaseUrl) {
    return {
      profile: env.databaseProfile,
      connectionString: env.databaseUrl,
      isMockConnection: false,
    };
  }

  if (isRealDataMode || env.databaseProfile === "neon") {
    throw new Error("NEON_DATABASE_URL or DATABASE_URL must be set when DATA_SOURCE_MODE=real or DATABASE_PROFILE=neon");
  }

  return {
    profile: env.databaseProfile,
    connectionString: MOCK_DATABASE_URL,
    isMockConnection: true,
  };
};
