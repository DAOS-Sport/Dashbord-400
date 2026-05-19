import { env } from "../../shared/config/env";
import { createIntegrations } from "../../integrations";
import { createTelemetryRepository } from "../../modules/telemetry/repository";
import { createNominatimGeocodingProvider } from "../../integrations/geocoding/nominatim-adapter";
import { createReplitPhotoStorage } from "../../integrations/storage/replit-object-storage";
import { ragicCacheService } from "../../services/ragic-cache-service";

export const createAppContainer = () => ({
  config: env,
  integrations: {
    ...createIntegrations(),
    photoStorage: createReplitPhotoStorage(),
    geocoding: createNominatimGeocodingProvider(),
  },
  repositories: {
    telemetry: createTelemetryRepository(),
  },
  services: {
    ragicCache: ragicCacheService,
  },
});

export type AppContainer = ReturnType<typeof createAppContainer>;
